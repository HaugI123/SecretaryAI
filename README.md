Client is the front end portion of the app. All UI should be developed there. Server is the back end portion of the app, API calls, requests and responses, algorithm work etc ran here. Database is where the db will be stored, storage should be a separate storage style for the documents we can process them as csv's, leave them exact as pdf's etc. Just another layer of saving information. 

Getting Started:

Install node.js, postgreSQL, and git if not installed.

Verify Node and npm in terminal:
node --version
npm --version

Clone repository:
Use desktop and click the fetch origin.

Install Frontend from terminal:
cd client
npm install

Install Backend from separate terminal:
cd server
npm install

Create file named .env inside server directory. (This file houses information you dont want viewed inside the application)

With both terminals open still inside client and server run in both terminals:
npm run dev

Each should give a return saying it ran and output a http://localhost:5*** with 3 digits replacing the *** somewhere in the terminal. Clicking on the one that the client terminal returns should open a browser to the example App.jsx page. If you want verification the backend is working type http://localhost:5***/api/test. Use the values from the terminal that ran from the server file.  
