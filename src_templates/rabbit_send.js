var amqp = require('amqplib/callback_api');

amqp.connect('amqp://localhost', function(error0, connection) {
  if (error0) {
    throw error0;
  }

  let sendChannel;
  let count = 0;

  const sendOneMessage = () => {
    var queue = 'hello';
    var msg = 'Hello world';

    sendChannel.assertQueue(queue, {
      durable: false
    });

    sendChannel.sendToQueue(queue, Buffer.from(msg));
    console.log(" [%d] Sent %s", count, msg);
  }

  connection.createChannel(function(error1, channel) {
    if (error1) {
      throw error1;
    }

    sendChannel = channel;

    sendOneMessage();
  });

  const sendPlentyOfMessages = () => {
    setTimeout(function() {   
        count++;
        sendOneMessage();
        if (count > 10000) {
            connection.close();
            process.exit(0);
        } else {
            sendPlentyOfMessages();
        }
    }, 500);
  }

  sendPlentyOfMessages();
});

