import { useEffect, useState } from "react";

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
    <div>
    <h1>React → Node Test</h1>
    <p>{message}</p>
    </div>
  );
}

export default App;
