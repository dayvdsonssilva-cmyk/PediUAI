export default async function handler(req, res) {
  if (req.method === "POST") {
    
    const body = req.body;

    console.log("Pagamento recebido:", body);

    // aqui você valida o pagamento depois

    return res.status(200).json({ received: true });
  }

  res.status(405).end();
}
