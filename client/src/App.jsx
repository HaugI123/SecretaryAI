import { useEffect, useState } from "react";
import LandingPage from './pages/landingPage.jsx'

function App() {
  const [message, setMessage] = useState("Connecting...");

  useEffect(() => {
    fetch("http://localhost:5000/api/test")
    .then((response) => response.json())
    .then((data) => setMessage(data.message))
    .catch((error) => {
      console.error(error);
      setMessage("Failed to connect to Node server");
    });
  }, []);

  return (
    <LandingPage />
  );
}

export default App;
