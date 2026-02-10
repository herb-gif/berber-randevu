type NotifyPayload = {
  phone: string;
  text: string;
};

export async function sendMessage({ phone, text }: NotifyPayload) {
  // TEST MODU
  console.log("==== NOTIFICATION ====");
  console.log("TO:", phone);
  console.log(text);
  console.log("======================");
}
