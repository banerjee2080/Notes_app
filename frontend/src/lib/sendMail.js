import axiosInstance from "./axios.js";

async function sendMail(receiverMail, subject, htmlContent) {
  try {
    const response = await axiosInstance.post("/auth/send-mail", {
      receiverMail,
      subject,
      htmlContent,
    });
    console.log("Email sent successfully", response.data);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

export default sendMail;
