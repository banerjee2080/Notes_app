import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.MODE === "production" ? "/api" : "http://localhost:5001/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response.status === 429) {
      alert("Too many requests. Please try again later.");
    }
    throw error;
  },
);

export default api;
