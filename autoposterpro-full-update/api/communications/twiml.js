// api/communications/twiml.js
// TwiML response for Twilio call routing

export default async function handler(req, res) {
  const { to } = req.query;
  
  // Set content type for TwiML
  res.setHeader('Content-Type', 'application/xml');
  
  // Generate TwiML to connect the call
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you now. Please hold.</Say>
  <Dial callerId="${process.env.TWILIO_PHONE_NUMBER}" timeout="30" action="/api/communications/dial-callback">
    <Number>${to}</Number>
  </Dial>
  <Say voice="alice">The call could not be completed. Please try again later.</Say>
</Response>`;
  
  return res.status(200).send(twiml);
}
