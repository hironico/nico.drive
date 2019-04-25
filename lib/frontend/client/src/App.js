import React, { Component } from 'react';
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import './App.css';

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import ProgressBar from 'react-bootstrap/ProgressBar';

import NavBar from './NavBar/NavBar';
import GlobalAlert from './GlobalAlert/GlobalAlert';

import ProgressBarJS from './ProgressBar/progressbar';

var Circle = ProgressBarJS.Circle;

const uuidv4 = require('uuid/v4');

const Template = ({ title }) => (
  <div>
    <p className="page-info">
      This is the {title} page.
    </p>
  </div>
);

class Home extends React.Component {
  constructor(props) {
    super(props);
    this.openFile = this.openInputFile.bind(this);
    this.inputFileChanged = this.inputFileChanged.bind(this);
    this.generateUploadLink = this.generateUploadLink.bind(this);
    this.state = {
      filesToSend: [],
      overallProgress: 0.65
    };
  }

  componentDidMount() {
    document.getElementById('input-file').addEventListener('change', this.inputFileChanged);
  }

  inputFileChanged() {
    var listOfFiles = document.getElementById('input-file').files;
    var arrayOfFiles = this.state.filesToSend;
    for (var index = 0; index < listOfFiles.length; index++) {
      const file = listOfFiles[index];
      arrayOfFiles.push(file);
      console.log('Must send : ' + file.name + ' ' + file.size + ' bytes.');
    };

    this.setState({
      filesToSend: arrayOfFiles
    });

    if (this.state.filesToSend.length > 0) {
      document.getElementById('step-one').classList.remove('active');
      document.getElementById('step-two').classList.add('active');
      this.generateUploadLink();
    }
  }

  generateUploadLink() {
    if (this.state.filesToSend.length <= 0) {
      return;
    }

    document.getElementById('upload-link').value = uuidv4();
  }

  copyUploadLink() {
    if (this.state.filesToSend.length <= 0) {
      return;
    }

    var copyText = document.getElementById("upload-link");
    copyText.select();
    document.execCommand("copy");
    document.getElementById('step-one').classList.remove('active');
    document.getElementById('step-two').classList.remove('active');
    document.getElementById('step-three').classList.add('active');
  }

  sendFile(file) {
    var oXHR = new XMLHttpRequest();
    oXHR.upload.addEventListener('progress', this.uploadProgress, false);
    oXHR.addEventListener('load', this.uploadFinish, false);
    oXHR.addEventListener('error', this.uploadError, false);
    oXHR.addEventListener('abort', this.uploadAbort, false);
    oXHR.open('POST', '%PUBLIC_URL%/api/file');
    oXHR.send(file);
  }

  uploadProgress(evt) {
    console.log(JSON.stringify(evt));
  }

  uploadFinish(evt) {
    console.log(JSON.stringify(evt));
  }

  uploadError(evt) {
    console.log(JSON.stringify(evt));
  }

  uploadAbort(evt) {
    console.log(JSON.stringify(evt));
  }

  openInputFile() {
    document.getElementById('input-file').click();
  }

  render() {
    var listElement = <div>Drag and drop files here or use the button below to add file(s).</div>;
    if (typeof this.state.filesToSend !== 'undefined' && this.state.filesToSend.length > 0) {
      listElement = <>
        <Card style={{ width: '100%' }}>
          <ListGroup variant="flush">
            {
              this.state.filesToSend.map((oneFile, id) => {
                return <ListGroup.Item key={id}>
                  <Container fluid>
                    <Row>
                      <Col log={2}>
                        <i className="fas fa-cloud-upload-alt fa-2x"></i>
                      </Col>
                      <Col lg={8}>
                        <div>
                          {oneFile.name}
                          <ProgressBar striped srOnly animated variant="info" now={40} />
                        </div>
                      </Col>
                      <Col lg={2}>
                        <span class="fa-stack">
                          <i class="fas fa-square fa-stack-2x"></i>
                          <i class="far fa-trash-alt fa-stack-1x fa-inverse"></i>
                        </span>
                      </Col>
                    </Row>
                  </Container>
                </ListGroup.Item>
              })
            }
          </ListGroup>
        </Card>
      </>
    }

    return (
      <Container>
        <Row>
          <Col>
            <GlobalAlert ref={(el) => { this.alertComp = el }} ></GlobalAlert>
          </Col>
        </Row>
        <Row className="upload-row">
          <Col lg={4} className="upload-status">
            <h4>Anonymous upload</h4>
            <hr />
            <ol className="upload-step-list">
              <li id="step-one" className="upload-step active">Choose files to uplaod</li>
              <li id="step-two" className="upload-step">Copy the link for the files:<br />
                <InputGroup className="mb-3">
                  <InputGroup.Prepend>
                    <Button id="upload-link-refresh" variant="secondary" onClick={() => this.generateUploadLink()}><i class="fas fa-sync-alt"></i></Button>
                  </InputGroup.Prepend>
                  <Form.Control type="text" id="upload-link" readOnly></Form.Control>
                  <InputGroup.Append>
                    <Button id="upload-link-copy" variant="secondary" onClick={() => this.copyUploadLink()}><i class="far fa-copy"></i></Button>
                  </InputGroup.Append>
                </InputGroup>
                <div className="small-warning">
                  <i class="fas fa-exclamation-triangle"></i> We do NOT store this link to anywhere. Please keep it in a safe place. We won't tell about lost links!
            </div>
              </li>
              <li id="step-three" className="upload-step">Upload<br />
                <Form.Check inline label="I have read and I understand the terms and conditions of using this service." type="checkbox" id="upload-check-conditions" />
                <Button id="upload-button" variant="success" disabled onClik={() => this.startUpload()}><i className="fas fa-cloud-upload-alt fa-2x"></i>&nbsp;Start upload!</Button>
              </li>
            </ol>
            <hr />

            <Circle
              progress={this.state.overallProgress}
              text="Overall progress"
              options={{ strokeWidth: 2, color: '#FFFFFF', trailColor: 'rgb(125,125,125)' }}
              initialAnimate={true}
            />
            
          </Col>
          <Col lg={8} className="upload-file-list">
            {listElement}
            <hr />
            <div className="drop-zone-container">
              <div className="drop-zone text-center">
                Drop files here to add them to the upload list.
              </div>
            </div>
            <Form.Control size="lg" type="file" id="input-file" className="input-file" multiple />
            <div className="upload-commands">
              <Button variant="primary" onClick={() => this.openInputFile()}>Add file(s)...</Button>
            </div>
          </Col>
        </Row>
      </Container>
    );
  }
};

const Profile = (props) => (
  <Template title="Profile" />
);

class App extends Component {
  render() {
    return (
      <Router>
        <div>
          <NavBar />

          <Route exact path="/" component={Home} />
          <Route path="/profile" component={Profile} />
        </div>
      </Router>
    );
  }
}

export default App;