const express = require('express');
const { ref, get, push, set, update, runTransaction, equalTo, orderByChild, query } = require('firebase/database');
const database = require('../dbConnect');
const { sendPushNotification } = require('../services/sendPushNotification');
const { sendSMS } = require('../services/sendSMS');

const orderRouter = express.Router();

orderRouter.get('/', async (req, res) => {
  try {
    const reference = ref(database, 'Orders');
    const snapshot = await get(reference);

    if (snapshot.exists()) {
      res.json(snapshot.val());
    } else {
      res.status(404).send('No data available in Firebase');
    }
  } catch (error) {
    console.error('Error fetching data from Firebase:', error);
    res.status(500).send('Failed to fetch data from Firebase');
  }
});

orderRouter.post('/', async (req, res) => {
  try {    
    console.log("NEW ORDER INCOMING");
    
    const { idempotencyKey, time: orderTime } = req.body;
    console.log("idempotencyKey:", idempotencyKey);
    const time = new Date(orderTime);
    time.setMinutes(time.getMinutes() + time.getTimezoneOffset()); 
    const year = time.getFullYear();
    const month = String(time.getMonth() + 1).padStart(2, '0');
    const day = String(time.getDate()).padStart(2, '0');

    const reference = ref(database, `Orders/${year}/${month}/${day}`);

    // 1. ZAŠTITA OD DUPLANJA: Ako postoji ključ, provjeri bazu za taj dan
    if (idempotencyKey) {
      const duplikatQuery = query(reference, orderByChild('idempotencyKey'), equalTo(idempotencyKey));
      const snapshot = await get(duplikatQuery);
      
      if (snapshot.exists()) {
        const postojeceNarudzbe = snapshot.val();
        const postojeciId = Object.keys(postojeceNarudzbe)[0];
        console.log(`Pronađena postojeća narudžba za ključ ${idempotencyKey}. Vraćam stari ID: ${postojeciId}`);
        
        res.status(200).set({ 'Content-Type': 'application/json' });
        return res.send(JSON.stringify({ id: postojeciId }));
      }
    }

    // 2. Ako ne postoji, generiraj novu narudžbu
    const newOrderRef = push(reference);
    await set(newOrderRef, req.body);

    // 3. Slanje odgovora natrag klijentu
    res.status(201).set({
      'Content-Type': 'application/json',
      'Connection': 'close' // 'close' je sigurniji za mobilni prvi zahtjev jer odmah javlja mobitelu da je gotovo
    });
    return res.send(JSON.stringify({ id: newOrderRef.key }));

  } catch (error) {
    console.error('Error creating order:', error);
    if (!res.headersSent) {
      return res.status(500).send('Failed to create order');
    }
  }
});


orderRouter.get('/:year/:month/:day/:orderId', async (req, res) => {
  try {
    const { year, month, day, orderId } = req.params;
    console.log(year, month, day, orderId );

    reference = ref(database, `Orders/${year}/${month}/${day}/${orderId}`);
    
    const snapshot = await get(reference);

    if (snapshot.exists()) {
      res.json(snapshot.val());
    } else {
      res.status(404).send('No order found');
    }
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).send('Failed to fetch order');
  }
});


orderRouter.get('/:year/:month/:day', async (req, res) => {
  try {
    const { year, month, day } = req.params;
    console.log(year, month, day);

    const reference = ref(database, `Orders/${year}/${month}/${day}`);
    const snapshot = await get(reference);

    if (snapshot.exists()) {
      const orders = snapshot.val();

      res.json(orders);
    } else {
      res.status(404).send('No orders found for this date');
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Failed to fetch orders');
  }
});


orderRouter.patch('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, year, month, day } = req.body; 
    
    console.log(`Updating order ${orderId} status to ${status}`);
    console.log(year, month, day);
    if (!status || (status !== 'accepted' && status !== 'rejected' && status !== 'completed')) {
      return res.status(400).send('Invalid status. Please provide "accepted" or "rejected"');
    }

    const reference = ref(database, `Orders/${year}/${month}/${day}/${orderId}`);

    const snapshot = await get(reference);
    
    if (!snapshot.exists()) {
      return res.status(404).send('Order not found');
    }

    const orderData = snapshot.val();
    const pushToken = orderData.token;
    let phone = orderData.phone;
    let price = orderData.totalPrice;

    // 2. Ažuriranje loyalty-a
    console.log('Ažuriranje loyalty bodova za telefon:', phone, 'sa cijenom:', price);
    if (phone && price != null) {
      const loyaltyRef = ref(database, `Loyalty/${phone}`);

      const result = await runTransaction(loyaltyRef, (currentData) => {
        let data = currentData || { loyalty_points: 0, awards: 0 };
        
        data.loyalty_points = (data.loyalty_points || 0) + price;
        
        data.awards = data.awards || 0; 
        
        return data;
      });

      if (result.committed) {
        console.log(`Loyalty podaci za telefon ${phone} uspešno ažurirani. Novi bodovi: ${result.snapshot.val().points}`);
      } else {
        console.log('Transakcija loyalty bodova nije izvršena.');
      }
    }

    // Konstruiranje poruke
    let message = '';
    const lang = orderData.language;
    let title = "Gricko";
    if (status === 'accepted') {
      message = lang === 'hr' ? 'Vaša narudžba je prihvaćena': `Your order has been accepted.`;
    } else if (status === 'rejected') {
      message = lang === 'hr' ? 'Nažalost Vaša narudžba je odbijena': `Unfortunately your order has been rejected.`;
    } else if (status === 'completed' && !orderData.isDelivery) {
      message = lang === 'hr' ? 'Vaša narudžba je završena': `Your order has been completed.`;
    }
    if (message !== '') {
    if (!pushToken) {
      sendSMS(orderData.phone, "Gricko automatska poruka: "+message);
    } else {
      await sendPushNotification(pushToken, title, message);
      console.log('Push notification sent to client');
    }
  }


    // Update the status of the order in the database
    await update(reference, { status });

    res.status(200).send(`Order ${orderId} status updated to ${status}`);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).send('Failed to update order status');
  }
});

// Zapamtite: I dalje morate implementirati logiku smanjenja bodova u POST /orders ruti (handleFinalSubmission)
// ako klijent pošalje useAward: true.


module.exports = orderRouter;
