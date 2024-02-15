/**
 * Import Lib
 */
const express   = require('express');
const fs        = require('fs');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { body, validationResult } = require('express-validator');
const { phoneNumberFormatter, isValidPhoneNumber } = require('./helpers/formatter');
const socketIO  = require('socket.io');
const qrcode    = require('qrcode');
const http      = require('http');

/**
 * Create server
 */
const port   = process.env.PORT || 9999;
const app    = express();
const server = http.createServer(app);
const io     = socketIO(server);

app.use(express.json({limit:"50mb"}));
app.use(express.urlencoded({
  extended: true,
  limit: "50mb"
}));

(async() => {
  
  /**
   * Setup whatsapp-web
   */
  const client = new Client({
      restartOnAuthFail: true,
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // <- this one doesn't works in Windows
          '--disable-gpu'
        ],
      },
      authStrategy: new LocalAuth(),
      // session: savedSession
  });

  client.initialize();

  /**
   * Send qrcode to F.E using socket.io
   */
  io.on('connection', function(socket) {
      socket.emit('message', 'Connecting...');
    
      client.on('qr', (qr) => {
        console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, (err, url) => {
          socket.emit('qr', url);
          socket.emit('message', 'QR Code received, scan please!');
        });
      });
    
      client.on('ready', () => {
        socket.emit('ready', 'Whatsapp is ready!');
        socket.emit('message', 'Whatsapp is ready!');
      });
    
      client.on('authenticated', (session) => {
        socket.emit('authenticated', 'Whatsapp is authenticated!');
        socket.emit('message', 'Whatsapp is authenticated!');

        console.log('AUTHENTICATED',session);
        // db.saveSession(session);
      });
    
      client.on('auth_failure', function(session) {
        socket.emit('message', 'Auth failure, restarting...');
      });
    
      client.on('disconnected', (reason) => {
        socket.emit('message', 'Whatsapp is disconnected!');

        // db.removeSession();
        client.destroy();
        client.initialize();
      });
  });

  /**
   * Endpoints
   * =========================
   */

  // show frontend
  app.get('/', (req, res) => {
      res.sendFile('index.html', {
        root: __dirname
      });
  });

  // check number is registered
  let rulesEndpointCheckNum = [
      body('number').notEmpty(),
  ];

  app.post('/checknumber', rulesEndpointCheckNum, async (req, res) => {
      // catch error rules
      const errors = validationResult(req).formatWith(({
        msg
      }) => {
        return msg;
      });
    
      // send error rules
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: false,
          message: errors.mapped()
        });
      }

      try {
        // Periksa apakah nomor yang diformat valid
        if (!isValidPhoneNumber(req.body.number)) {
          return res.status(400).json({
              status: false,
              message: 'invalid phone number format'
          });
        }

        const isRegisteredNumber = await client.isRegisteredUser(phoneNumberFormatter(req.body.number));
      
        if (!isRegisteredNumber) {
          return res.status(404).json({
            status: false,
            message: 'wa not registered'
          });
        }
        else {
            return res.status(200).json({
                status: true,
                message: 'ok'
            });
        }
      } 
      catch (error) {
        console.log("New Error: ",error);

        return res.status(500).json({
          status: false,
          message: 'server bussy'
        });
      }
      
  });

  // send message
  let rulesSendMessage = [
      body('to').notEmpty(),
      body('message').notEmpty(),
  ];

  app.post('/sendmessage', rulesSendMessage, async (req, res) => {
      // catch error rules
      const errors = validationResult(req).formatWith(({
        msg
      }) => {
        return msg;
      });
    
      // send error rules
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: false,
          message: errors.mapped()
        });
      }
    
      
      try {
        const toNumber = phoneNumberFormatter(req.body.to)
        const isRegisteredNumber = await client.isRegisteredUser(toNumber);
      
        if (!isRegisteredNumber) {
          return res.status(404).json({
            status: false,
            message: 'wa not registered'
          });
        }
    
        client.sendMessage(toNumber, req.body.message).then(response => {
            res.status(200).json({
              status: true,
              message: 'message successfully sent'
            });
        }).catch(err => {
            res.status(500).json({
              status: false,
              message: "server bussy"
            });
        });
      } 
      catch (error) {
        console.log("New Error: ",error);

        return res.status(500).json({
          status: false,
          message: 'server bussy'
        });
      }
      
  });

  // send pdf 
  let rulesSendPdfAsImg = [
    body('tonumber').notEmpty(),
    body('filename').notEmpty(),
    body('binarypdf').notEmpty(),
  ];

  app.post('/sendpdf', rulesSendPdfAsImg, async (req, res) => {
    // catch error rules
    const errors = validationResult(req).formatWith(({
      msg
    }) => {
      return msg;
    });
  
    // send error rules
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        message: errors.mapped()
      });
    }
    
    try {
      let buffer   = Buffer.from(req.body.binarypdf, "base64");
      let toNumber = phoneNumberFormatter(req.body.tonumber)
      fs.writeFileSync("./tmppdf/" + req.body.filename + ".pdf",buffer)
      
      const media = MessageMedia.fromFilePath("./tmppdf/" + req.body.filename + ".pdf");

      client.sendMessage(toNumber, media).then(response => {
          fs.unlinkSync("./tmppdf/" + req.body.filename + ".pdf");

          res.status(200).json({
            status: true,
            message: 'media successfully sent'
          });
      }).catch(err => {
          fs.unlinkSync("./tmppdf/" + req.body.filename + ".pdf");

          res.status(500).json({
            status: false,
            message: err
          });
      });
    } 
    catch (error) {
      console.log("New Error: ",error);

      return res.status(500).json({
        status: false,
        message: 'server error'
      });
    }
  });

  server.listen(port, function() {
      console.log('App running on *: ' + port);
  });

})();
