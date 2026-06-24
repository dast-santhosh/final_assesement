// Backend API Service - Secure Exam Proctor
const getBackendUrl = () => {
  // If running locally on the Vite Dev Server (port 5173), route to port 5000 local Express.
  if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '5173') {
    return 'http://localhost:5000';
  }
  
  // For Vercel combined frontend/backend deployment, relative URLs on the same domain are used
  return '';
};

export const BACKEND_URL = getBackendUrl();

export const apiRequest = async (endpoint, options = {}, retries = 3) => {
  const url = `${BACKEND_URL}${endpoint}`;
  
  // Support custom simulated time headers if set in localStorage
  const simulatedTime = localStorage.getItem('simulated_time');
  const headers = {
    'Content-Type': 'application/json',
    ...(simulatedTime ? { 'x-simulated-time': simulatedTime } : {}),
    ...options.headers
  };

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds request timeout

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server Error: ${response.status}`);
      }

      return await response.json();
    } catch (e) {
      if (i === retries - 1) {
        throw new Error(e.message || 'Network error occurred. Please check your server connection.');
      }
      // Wait 1.5 seconds before retry
      await new Promise((res) => setTimeout(res, 1500));
    }
  }
};
