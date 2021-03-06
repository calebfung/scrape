const cron = require('node-cron');
const puppeteer = require('puppeteer');
const sgMail = require('@sendgrid/mail');

const schedule = '*/10 * * * * *';
const url = 'https://us1.quickscreen.health/city-of-burleson#/screening';
const registeredEmail = '';
const destinationEmail = '';
var browser, task;

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: destinationEmail,
  from: registeredEmail,
  subject: 'Registration Open!',
  text: `Register at ${url}.`,
  html: `<h1>Registration Open!</h1><p>Register <a href="${url}">here</a>.</p>`,
};

/**
 * Logic
 */
const check = async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const task = cron.schedule(schedule, async () => {
    const registration = await page.$('.result-bar', { timeout: 5000 });
    
    if (registration !== null && await page.evaluate(el => el.textContent, registration) === 'Registration Closed') {
      // console.log('closed');
    } else {
      console.log('open');
      task.stop();
      sgMail
        .send(msg)
        .then(async () => {
          await browser.close();
          console.log('Email sent');
          process.exit(0);
        })
        .catch((error) => {
          console.error(error);
          process.exit(1);
        });
    }

    await page.reload({ waitUntil: ['networkidle0', 'domcontentloaded'] });
  }, {
    scheduled: false
  });

  task.start();

  return { browser, task };
};

/**
 * Main
 */
check()
  .then(({ browser, task }) => {
    browser = browser;
    task = task;
  })
  .catch(e => console.error(e));

/**
 * Graceful shutdown
 */
const handle = async () => {
  console.log('exiting...');
  if (task) task.stop();
  if (browser) await browser.close();
  process.exit(0);
};

process.on('SIGINT', handle);
process.on('SIGTERM', handle);
