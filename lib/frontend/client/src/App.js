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
var Line = ProgressBarJS.Line;

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
    this.agreeTermsOnChange = this.agreeTermsOnChange.bind(this);
    this.state = {
      filesToSend: [],
      overallProgress: 0.65,
      agreeTermsChecked: false,
      readyToUpload: false,
      linkCopied: false
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

    this.setState((prevState) => {
      return {
        filesToSend: arrayOfFiles
      };
    });

    if (this.state.filesToSend.length > 0) {
      document.getElementById('step-one').classList.remove('active');
      document.getElementById('step-two').classList.add('active');
      this.generateUploadLink();
    }

    this.computeReadyToUpload();
  }

  generateUploadLink() {
    if (this.state.filesToSend.length <= 0) {
      return;
    }

    var uploadLink = uuidv4();
    document.getElementById('upload-link').value = uploadLink;

    this.setState((prevState) => {
      return {
        linkCopied: false,
        uploadLink: uploadLink
      }
    });

    this.computeReadyToUpload();

    document.getElementById('step-one').classList.remove('active');
    document.getElementById('step-three').classList.remove('active');
    document.getElementById('step-two').classList.add('active');

  }

  copyUploadLink() {
    if (this.state.filesToSend.length <= 0) {
      return;
    }

    var copyText = document.getElementById("upload-link");
    copyText.select();
    document.execCommand("copy");
    this.setState((prevState) => {
      return { linkCopied: true }
    });

    this.computeReadyToUpload();

    document.getElementById('step-one').classList.remove('active');
    document.getElementById('step-two').classList.remove('active');
    document.getElementById('step-three').classList.add('active');
  }

  agreeTermsOnChange(evt) {
    const checked = evt.target.checked;
    this.setState((prevState) => {
      return { agreeTermsChecked: checked };
    });
    this.computeReadyToUpload();
  }

  computeReadyToUpload() {

    this.setState((prevState) => {
      var ready = prevState.agreeTermsChecked &&
        (prevState.filesToSend.length > 0) &&
        prevState.linkCopied;

      console.log('Agree terms checked: ' + prevState.agreeTermsChecked);
      console.log('Files to send size: ' + prevState.filesToSend.length);
      console.log('Link copied: ' + prevState.linkCopied);
      console.log('Ready to upload: ' + ready);

      return { readyToUpload: ready };
    });
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
        <Card style={{ width: '100%', maxHeight: '400px', overflowY: 'scroll' }}>
          <ListGroup variant="flush">
            {
              this.state.filesToSend.map((oneFile, id) => {
                var fileSize = oneFile.size / 1024 / 1024;
                fileSize = fileSize.toFixed(2);
                /*
                return <ListGroup.Item key={id}>
                  <Container fluid>
                    <Row>
                      <Col log={2}>
                        <div className="text-right">
                          <i className="fas fa-cloud-upload-alt"></i>
                        </div>
                      </Col>
                      <Col lg={8}>
                        <div>
                          {oneFile.name}&nbsp;({oneFile.size / 1024} kB)
                          <ProgressBar striped srOnly animated variant="info" now={40} />
                        </div>
                      </Col>
                      <Col lg={2}>
                        <i className="far fa-trash-alt"></i>
                      </Col>
                    </Row>
                  </Container>
                </ListGroup.Item>
                */

                return <ListGroup.Item key={id}>
                  <div>
                    <h4><i className="fas fa-cloud-upload-alt"></i>&nbsp;{oneFile.name}<span className="file-upload-progress-icons"><i className="far fa-trash-alt"></i></span></h4>
                    <p className="small">Size: {fileSize}&nbsp; MB.</p>
                  </div>
                  <Line
                    progress={1}
                    text=""
                    options={{ 
                      strokeWidth: 1, 
                      trailWidth: 1,
                      color: '#ED6A5A', 
                      trailColor: '#eee', 
                      easing: 'easeInOut',
                      duration: 1400, 
                      svgStyle: {width: '100%', height: '100%'},
                      from: {color: '#ED6A5A'},
                      to: {color: '#009933'},
                      step: (state, bar) => {
                        bar.path.setAttribute('stroke', state.color);
                      }                               
                   }}
                    containerStyle="width: 100%;"
                    containerClassName="file-upload-progress"
                    initialAnimate={true}
                  />                  
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
              <li id="step-one" className="upload-step active">Choose files to upload</li>
              <li id="step-two" className="upload-step">Copy the link for the files:<br />
                <InputGroup className="mb-3">
                  <InputGroup.Prepend>
                    <Button id="upload-link-refresh" variant="secondary" onClick={() => this.generateUploadLink()}><i className="fas fa-sync-alt"></i></Button>
                  </InputGroup.Prepend>
                  <Form.Control type="text" id="upload-link" readOnly></Form.Control>
                  <InputGroup.Append>
                    <Button id="upload-link-copy" variant="secondary" onClick={() => this.copyUploadLink()}><i className="far fa-copy"></i></Button>
                  </InputGroup.Append>
                </InputGroup>
                <div className="small-warning">
                  <i className="fas fa-exclamation-triangle"></i> We do NOT store this link to anywhere. Please keep it in a safe place. We won't tell about lost links!
            </div>
              </li>
              <li id="step-three" className="upload-step">Upload<br />
                <Form.Check inline label="I have read and I understand the terms and conditions of using this service." type="checkbox" id="upload-check-conditions" checked={this.state.agreeTermsChecked} onChange={(evt) => this.agreeTermsOnChange(evt)} />
                <Button id="upload-button" variant="success" disabled={!this.state.readyToUpload} onClick={() => this.startUpload()}><i className="fas fa-cloud-upload-alt fa-2x"></i>&nbsp;Start upload!</Button>
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