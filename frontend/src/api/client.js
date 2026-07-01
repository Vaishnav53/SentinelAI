import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 65000, // 65 second timeout
});

// Response interceptor to format errors into standard envelopes
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // If server returned structured error envelope, propagate it
    if (error.response && error.response.data && error.response.data.error) {
      return Promise.reject(error.response.data.error);
    }
    
    // Otherwise construct standard error message
    const standardError = {
      code: 'API_ERROR',
      message: error.message || 'An unexpected connection error occurred.',
      details: error.response ? error.response.data : {}
    };
    return Promise.reject(standardError);
  }
);

export default apiClient;
