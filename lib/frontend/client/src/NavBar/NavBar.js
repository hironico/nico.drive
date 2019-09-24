import React from 'react';

import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';

const NavBar = () => (
    <Navbar bg="dark" variant="dark">
      <Navbar.Brand href="#home">Nico's Drive</Navbar.Brand>
      <Navbar.Toggle aria-controls="basic-navbar-nav" />
      <Navbar.Collapse id="basic-navbar-nav">
        <Nav className="mr-auto">
          <Nav.Link href="/">Upload</Nav.Link>
          <Nav.Link href="/download">Download</Nav.Link>
          <Nav.Link href="/profile">Profile</Nav.Link>
        </Nav>
      </Navbar.Collapse>
    </Navbar>
  );

  export default NavBar;