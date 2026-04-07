BeanThere: A Study-Friendly Café Discovery and Review Web Application


Description

  BeanThere is a web application that helps users discover and review study-friendly
  cafes based on features such as Wi-Fi, sockets, and environment. It also allows
  cafe owners to manage their cafe profiles and interact with users through reviews.


Features

  - User authentication (login and signup)
  - Cafe search and filtering
  - Review and rating system
  - Owner replies to reviews
  - User profile management
  - TBV (To Be Visited) cafe discovery page


CRUD Operations

  The system fully implements CRUD operations for its core features:

  CREATE
    Users can create accounts and submit reviews.
    Cafe owners can crate and manage their cafe profiles.

  READ
    Users can view the cafe listings, reviews, and profiles.
    Data is retrieved from the MongoDB database and displayed in the frontend.

  UPDATE
    Users can edit their profiles and reviews.
    Cafe owners can update cafe information and respond to reviews.

  DELETE
    Users can delete their own reviews.
    Data is properly removed from the database.


Technologies Used
  - HTML, CSS, JavaScript
  - Node.js, Express
  - MongoDB (Compass/ Atlas)
  - Mongoose


How to Run the Project
  1. Open the project in VS Code
  2. Navigate to the project folder
      - >  cd CCAPDEV-MCO1-main/CCAPDEV-MCO1-main
  3. Install dependencies
      - >  npm install
  4. Make sure MongoDB is running (Compass or Atlas connection)
  5. Start the server
      - > npm start
  6. Open the application in a browser
      - > http://localhost:3000


Project Structure
  config/ - database connection
  models/ - MongoDB schemas
  bean there/ - frontend files
  app.ks - main server file


Group Members
  Escueta, Cassandra Jersey M.
  Galinato, Erylle Jerica U.
  Nicolas, Sophia Lauren R.
  Yap, Adrian Jericho M.


Notes
  - Node.js must be installed
  - MongoDB must be running before starting the server
