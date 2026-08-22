import 'dotenv/config'
import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

async function createTestOrders() {
  const amounts = [49900, 129900, 249900, 89900, 599900] // paise

  for (const amount of amounts) {
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    })
    console.log(`Created order: ${order.id} for ₹${amount / 100}`)
  }
}

createTestOrders().catch(console.error)