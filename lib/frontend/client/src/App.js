import React, { Component } from 'react';
import { BrowserRouter as Router, Route } from "react-router-dom";
import './App.css';

import NavBar from './NavBar/NavBar';
import Upload from './Upload/upload';
import Download from './Download/download';

const Template = ({ title }) => (
  <div>
    <p className="page-info">
      This is the {title} page.
    </p>
  </div>
);


const Profile = (props) => (
  <Template title="Profile" />
);

class App extends Component {
  render() {
    return (
      <Router>
        <div>
          <NavBar />

          <Route exact path="/" component={Upload} />
          <Route path="/download" component={Download} />
          <Route path="/profile" component={Profile} />
        </div>
      </Router>
    );
  }
}

export default App;