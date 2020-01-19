import React, { Component } from 'react';

import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import InputGroup from 'react-bootstrap/InputGroup';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';

import GlobalAlert from '../GlobalAlert/GlobalAlert';
import ProgressBarJS from '../ProgressBar/progressbar';

import { AppContextValues } from '../AppContext';

var Circle = ProgressBarJS.Circle;
var Line = ProgressBarJS.Line;

const uuidv4 = require('uuid/v4');

class Upload extends Component {

    constructor(props) {
        super(props);

        this.openFile = this.openInputFile.bind(this);
        this.inputFileChanged = this.inputFileChanged.bind(this);
        this.generateUploadLink = this.generateUploadLink.bind(this);
        this.agreeTermsOnChange = this.agreeTermsOnChange.bind(this);
        this.removeFileToSend = this.removeFileToSend.bind(this);
        this.state = {
            filesToSend: [],
            pendingFiles: [],
            maxPendingFiles: 3,
            overallProgress: 0.0,
            agreeTermsChecked: false,
            readyToUpload: false,
            linkCopied: false
        };

        this.apiRootUrl = AppContextValues.apiRootUrl;
    }

    componentDidMount() {
        document.getElementById('input-file').addEventListener('change', this.inputFileChanged);
    }

    startUpload() {
        if (!this.state.readyToUpload) {
            return;
        }

        if (this.state.filesToSend.length === 0) {
            return;
        }

        this.setState((prevState) => {
            return {
                overallProgress: 0.0,
                unitProgress: 1 / prevState.filesToSend.length
            }
        });

        console.log('Starting upload of ' + this.state.filesToSend.length + ' files.');        
        let oneFile = this.state.filesToSend[0];
        
        this.setState((prevState) => {            
            prevState.filesToSend.pop();    
            prevState.pendingFiles.push(oneFile);
            return {
                filesToSend: [...prevState.filesToSend],
                pendingFiles: [...prevState.pendingFiles]
            }
        });

        this.sendFile(oneFile);
    }

    inputFileChanged() {
        var listOfFiles = document.getElementById('input-file').files;
        var arrayOfFiles = this.state.filesToSend;
        for (var index = 0; index < listOfFiles.length; index++) {
            const file = listOfFiles[index];
            const existingIndex = arrayOfFiles.indexOf(file);
            if (existingIndex < 0) {
                arrayOfFiles.push(file);
                console.log('Must send : ' + file.name + ' ' + file.size + ' bytes.');
            } else {
                console.log('File seems to exists. Skipping: ' + file.path);
            }
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

    removeFileToSend(fileToRemove) {
        if (this.state.filesToSend.length <= 0) {
            return;
        }

        const index = this.state.filesToSend.indexOf(fileToRemove);
        if (index < 0) {
            return;
        }

        this.setState((prevState) => {
            prevState.filesToSend.splice(index, 1);
            return {
                filesToSend: [...prevState.filesToSend]
            }
        });
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

            /*
            console.log('Agree terms checked: ' + prevState.agreeTermsChecked);
            console.log('Files to send size: ' + prevState.filesToSend.length);
            console.log('Link copied: ' + prevState.linkCopied);
            console.log('Ready to upload: ' + ready);
            */

            return { readyToUpload: ready };
        });
    }

    sendFile(file) {
        var oXHR = new XMLHttpRequest();
        
        oXHR.onupload = this.uploadProgress.bind(this);
        oXHR.onload = this.uploadFinish.bind(this);
        oXHR.onerror = this.uploadError.bind(this);
        oXHR.onabort = this.uploadAbort.bind(this);

        // Must bind this react class to the listener to access the 'this' reference properly
        // oXHR.upload.addEventListener('progress', this.uploadProgress, false);
        // oXHR.addEventListener('load', this.uploadFinish, false);
        // oXHR.addEventListener('error', this.uploadError, false);
        // oXHR.addEventListener('abort', this.uploadAbort, false);

        // let targetUrl = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port;
        let targetUrl = this.apiRootUrl + '/file';

        oXHR.open('POST', targetUrl);

        // personnalized headers for server to store file at the right place.
        oXHR.setRequestHeader('x-nicodrive-uploadlink', this.state.uploadLink);
        oXHR.setRequestHeader('x-nicodrive-filename', file.name);
        oXHR.setRequestHeader('x-nicodrive-filesize', file.size);
        oXHR.setRequestHeader('Content-Type', 'application/octet-stream');

        oXHR.send(file);
    }

    uploadProgress(evt) {
        console.log(JSON.stringify(evt));
        var percentComplete = evt.loaded / evt.total * 100;
        console.log('PROGRESS> ' + percentComplete + '% completed.');
    }

    uploadFinish(evt) {
        console.log('FINISHED');

        const finishedFile = this.state.pendingFiles[0];

        this.setState((prevState) => {
            return {
                pendingFiles: []
            }
        });

        let props = "finished FILE is:"
        for (var prop in finishedFile){ props+= prop +  " => " + finishedFile[prop] + "\n"; }
        console.log(props);

        // start upload of next file if any
        console.log('Still ' + this.state.filesToSend.length + ' files to upload.');
        if (this.state.filesToSend.length > 0) {
            let oneFile = this.state.filesToSend[0];

            this.setState((prevState) => {
                prevState.filesToSend.pop();
                prevState.pendingFiles.push(oneFile);
                return {
                    pendingFiles: [...prevState.pendingFiles],
                    filesToSend: [...prevState.filesToSend]
                }
            });

            this.sendFile(oneFile);
        }
    }
    

    uploadError(evt) {
        console.log('ERROR');
        console.log(JSON.stringify(evt));
    }

    uploadAbort(evt) {
        console.log('ABORT');
        console.log(JSON.stringify(evt));
    }

    openInputFile() {
        document.getElementById('input-file').click();
    }


    render() {
        var listElement = <div>Drag and drop files here or use the button below to add file(s).</div>;
        if (typeof this.state.filesToSend !== 'undefined' && this.state.filesToSend.length > 0) {
            listElement = <>
                <Card style={{ width: '100%', maxHeight: '653px', overflowY: 'scroll' }}>
                    <ListGroup variant="flush">
                        {
                            this.state.filesToSend.map((oneFile, id) => {
                                var fileSize = oneFile.size / 1024 / 1024;
                                fileSize = fileSize.toFixed(2);

                                return <ListGroup.Item key={id}>
                                    <div>
                                        <h4><i className="fas fa-cloud-upload-alt"></i>&nbsp;{oneFile.name}<span className="file-upload-progress-icons"><a href="#remove" onClick={() => this.removeFileToSend(oneFile)}><i className="far fa-trash-alt"></i></a></span></h4>
                                        <p className="small">Size: {fileSize}&nbsp; MB.</p>
                                    </div>
                                    <Line
                                        progress={0.78}
                                        text=""
                                        options={{
                                            strokeWidth: 1,
                                            trailWidth: 1,
                                            color: '#ED6A5A',
                                            trailColor: '#eee',
                                            easing: 'easeInOut',
                                            duration: 1400,
                                            svgStyle: { width: '100%', height: '100%' },
                                            from: { color: '#ED6A5A' },
                                            to: { color: '#009933' },
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
                            <li id="step-one" className="upload-step active">Choose files to upload<br />
                                <div className="drop-zone-container">
                                    <div className="drop-zone text-center">
                                        Drop files here to add them to the upload list.
                                </div>
                                </div>
                                <Form.Control size="lg" type="file" id="input-file" className="input-file" multiple />
                                <div className="upload-commands">
                                    <Button variant="primary" onClick={() => this.openInputFile()}>Add file(s)...</Button>
                                </div>
                            </li>
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
                            </li>
                        </ol>
                        <hr />
                        <Button id="upload-button" variant="success" disabled={!this.state.readyToUpload} onClick={() => this.startUpload()}><i className="fas fa-cloud-upload-alt fa-2x"></i>&nbsp;Start upload!</Button>
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
                    </Col>
                </Row>
            </Container>
        );
    }
}

export default Upload;