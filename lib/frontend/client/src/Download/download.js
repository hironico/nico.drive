import React, { Component } from 'react';

import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import InputGroup from 'react-bootstrap/InputGroup';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';

import GlobalAlert from '../GlobalAlert/GlobalAlert';

import { AppContextValues } from '../AppContext';


class Download extends Component {
    constructor(props) {
        super(props);
        
        this.agreeTermsOnChange = this.agreeTermsOnChange.bind(this);
        this.computeReadyToDownload = this.computeReadyToDownload.bind(this);

        this.state = {
            agreeTermsChecked: false,
            readyToDownload: false,
            filesToDownload: []
        };

        this.apiRootUrl = AppContextValues.apiRootUrl;
    }

    agreeTermsOnChange(evt) {
        const checked = evt.target.checked;
        this.setState((prevState) => {
            return { agreeTermsChecked: checked };
        });
        this.computeReadyToDownload();
    }

    computeReadyToDownload() {
        this.setState((prevState) => {
            var linkValue = document.getElementById('upload-link').value
            var ready = prevState.agreeTermsChecked &&
                (typeof(linkValue) !== 'undefined') && ('' !== linkValue);

            return { readyToDownload: ready };
        });
    }

    searchLinkFiles() {
        const linkValue = document.getElementById('upload-link').value;
        if (typeof(linkValue) === 'undefined' || '' === linkValue) {
            return;
        }

        const that = this;

        var xhr = new XMLHttpRequest();
        const url = this.apiRootUrl + '/search/' + linkValue;
        xhr.open('GET', url);
        xhr.onload = function(event) {
            if (xhr.status === 200) {       
                that.setState((prevState) => {
                    return {
                        filesToDownload: JSON.parse(xhr.responseText)
                    };
                });
                
                console.log('Files to download for this link: ' + JSON.stringify(that.state.filesToDownload));
            } else {
                console.log('Error while downloading files list in this link id');
            }
            
        };
        xhr.send();
    }

    startDownload() {
        const linkValue = document.getElementById('upload-link').value;
    }

    render() {

        var listElement = <div>Enter the link id to see the list of files of the bundle.</div>;
        if (typeof this.state.filesToDownload !== 'undefined' && this.state.filesToDownload.length > 0) {
            listElement = <>
                <Card style={{ width: '100%', maxHeight: '653px', overflowY: 'scroll' }}>
                    <ListGroup variant="flush">
                        {
                            this.state.filesToDownload.map((oneFile) => {
                                var fileSize = oneFile.size / 1024 / 1024;
                                fileSize = fileSize.toFixed(2);

                                return <ListGroup.Item key={oneFile.path}>
                                    <div>
                                        <h4><i className="fas fa-file-download"></i>&nbsp;{oneFile.name}<span className="file-upload-progress-icons"><a href="#download" onClick={() => this.downloadOneFile(oneFile)}><i className="fas fa-cloud-download-alt"></i></a></span></h4>
                                        <p className="small">Size: {fileSize}&nbsp; MB.</p>
                                    </div>                                    
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
                        <h4>Download</h4>
                        <hr />
                        <ol className="upload-step-list">
                            <li id="step-one" className="upload-step">Paste the link for the files:<br />
                                <InputGroup className="mb-3">
                                    <Form.Control type="text" id="upload-link"></Form.Control>
                                    <InputGroup.Append>
                                        <Button id="upload-link-copy" variant="secondary" onClick={() => this.searchLinkFiles()}><i className="fas fa-search"></i></Button>
                                    </InputGroup.Append>
                                </InputGroup>
                                <div className="small-warning">
                                    <i className="fas fa-exclamation-triangle"></i> We do NOT store links to anywhere. We cannot retreive lost links!
                                </div>
                            </li>
                            <li id="step-two" className="upload-step">Confirm<br />
                                <Form.Check inline label="I have read and I understand the terms and conditions of using this service." type="checkbox" id="upload-check-conditions" checked={this.state.agreeTermsChecked} onChange={(evt) => this.agreeTermsOnChange(evt)} />
                            </li>
                        </ol>
                        <hr />
                        <Button id="download-button" variant="success" disabled={!this.state.readyToDownload} onClick={() => this.startDownload()}><i className="fas fa-cloud-download-alt fa-2x"></i>&nbsp;Start download!</Button>
                        <hr />
                    </Col>
                    <Col lg={8} className="upload-file-list">
                        {listElement}
                    </Col>
                </Row>
            </Container>
        );
    }
}

export default Download;