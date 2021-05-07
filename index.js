const cron = require('node-cron');
const express = require('express');
const nodemailer = require('nodemailer');
const https = require('https');

app = express();
cron.schedule('*/10 * * * *', function () {
  launchApp();
});
app.listen(3000);

// Change Params Here
const pinCodes = [
  '500084',
  '500032',
  '500049',
  '500075',
  '500019',
  '501203',
  '500082',
  '500072',
  '500033',
  '500045',
  '500018',
  '500050',
  '502032',
];
const minAge = 18; // 18 | 45
const emailAddresses = 'email@email.com, email2@email.com';
const feeType = 'Both'; // Paid | Free | Both
const sendNoSlotsEmail = true; // set to true if you need no slots available email
const smtpHost = 'smtpHost'; // for gmail use smtp.gmail.com
const smtpUsername = 'smtpUsername';
const smtpPwd = 'smtpPwd';
// End
let messageSent = false;
launchApp();
async function launchApp() {
  messageSent = false;
  await Promise.all(
    pinCodes.map(async (pinCode, i) => {
      if (messageSent) {
        return;
      }
      messageSent = !messageSent ? await getSlots(pinCode) : messageSent;
    })
  );
  if (!messageSent && sendNoSlotsEmail) {
    sendEmail(
      `Hello, \n\n\tNo slots available for your selected age group of ${minAge}+ at ${
        pinCodes.length
      } pincodes: ${pinCodes.join(', ')}. \n\nThanks.`
    );
    console.log('sent no slots email');
  }
  console.log(`Covid Vaccine Check Complete for ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
}

function sendEmail(message) {
  var subject = `CoWin Vaccination Availability Report: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;

  var transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: smtpUsername, // generated ethereal user
      pass: smtpPwd, // generated ethereal password
    },
  });

  var mailOptions = {
    from: smtpUsername,
    to: emailAddresses,
    subject: subject,
    text: message,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

function addDays(days) {
  var date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function formatDate(date) {
  var d = new Date(date),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [day, month, year].join('-');
}

async function getSlots(pinCode) {
  const week1 = formatDate(new Date());
  const week2 = formatDate(addDays(7));
  const week3 = formatDate(addDays(14));
  const week4 = formatDate(addDays(21));
  try {
    let centers = [];
    const result1 = await makeRequest(pinCode, week1);
    const result2 = await makeRequest(pinCode, week2);
    const result3 = await makeRequest(pinCode, week3);
    const result4 = await makeRequest(pinCode, week4);
    const response1 = JSON.parse(result1);
    const response2 = JSON.parse(result2);
    const response3 = JSON.parse(result3);
    const response4 = JSON.parse(result4);
    const centers1 = response1['centers'] ? response1['centers'] : [];
    const centers2 = response2['centers'] ? response2['centers'] : [];
    const centers3 = response3['centers'] ? response3['centers'] : [];
    const centers4 = response4['centers'] ? response4['centers'] : [];
    centers = centers1.concat(centers2).concat(centers3).concat(centers4);
    if (centers) {
      centers.forEach((center, i) => {
        if (messageSent) {
          return messageSent;
        }
        if (center && feeType != 'both' && center['fee_type'] != feeType) {
          return messageSent;
        }
        if (center && center['sessions']) {
          center['sessions'].forEach((session, j) => {
            if (messageSent) {
              return messageSent;
            }
            if (
              session &&
              session['min_age_limit'] <= minAge &&
              session['available_capacity'] > 0
            ) {
              sendEmail(
                `Hello, \n\n\tVaccination for your selected age group of ${minAge}+ and selected area is available from ${session['date']} at ${center['name']}, ${center['block_name']}, ${center['district_name']}, ${center['state_name']}, Pincode-${center['pincode']}. Go to https://selfregistration.cowin.gov.in/ right now. \n\nThanks.`
              );
              messageSent = true;
              console.log('sent SLOTS AVAILABLE email');
            }
          });
        }
      });
    }
  } catch (err) {
    console.log('Exception Somewhere!', err);
  }

  return messageSent;
}

function makeRequest(pincode, date) {
  const options = {
    hostname: 'cdn-api.co-vin.in',
    path: `/api/v2/appointment/sessions/public/calendarByPin?pincode=${pincode}&date=${date}`,
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
    },
  };
  return new Promise(function (resolve, reject) {
    https
      .get(options, (resp) => {
        let data = '';

        // A chunk of data has been received.
        resp.on('data', (chunk) => {
          data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', () => {
          resolve(data);
        });
      })
      .on('error', (err) => {
        console.log('Error: ' + err.message);
      });
  });
}
