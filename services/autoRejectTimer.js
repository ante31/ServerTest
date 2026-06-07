const { ref, get } = require("firebase/database");
const database = require("../dbConnect");
const { updateOrderStatus } = require("./updateOrderStatus");

const AUTO_REJECT_TIME = 1.5 * 60 * 1000;

const getOrder = async (orderId, year, month, day) => {
  const orderRef = ref(database, `Orders/${year}/${month}/${day}/${orderId}`);
  const snapshot = await get(orderRef);

  if (!snapshot.exists()) return null;
  return snapshot.val();
};

const startAutoRejectTimer = (orderId, year, month, day) => {
  setTimeout(async () => {
    try {
      const order = await getOrder(orderId, year, month, day);

      if (!order) return;

      if (order.status === "pending") {
        console.log(`Auto-rejecting order ${orderId}`);

        await updateOrderStatus({
          orderId,
          status: "auto-rejected",
          year,
          month,
          day,
        });
      }
    } catch (err) {
      console.error("Auto-reject error:", err);
    }
  }, AUTO_REJECT_TIME);
};

module.exports = { startAutoRejectTimer };