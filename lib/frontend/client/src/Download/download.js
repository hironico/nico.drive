import React, { Component } from 'react';

import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';

import GlobalAlert from '../GlobalAlert/GlobalAlert';

class Download extends Component {
    constructor(props) {
        super(props);
        this.agreeTermsOnChange = this.agreeTermsOnChange.bind(this);
        this.state = {
            agreeTermsChecked: false,
            readyToDownload: false
        };
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
            var ready = prevState.agreeTermsChecked;

            return { readyToDownload: ready };
        });
    }

    render() {

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
                                <Form.Control type="text" id="upload-link" readOnly></Form.Control>
                                <div className="small-warning">
                                    <i className="fas fa-exclamation-triangle"></i> We do NOT store links to anywhere. We cannot retreive lost links!
                                </div>
                            </li>
                            <li id="step-two" className="upload-step">Upload<br />
                                <Form.Check inline label="I have read and I understand the terms and conditions of using this service." type="checkbox" id="upload-check-conditions" checked={this.state.agreeTermsChecked} onChange={(evt) => this.agreeTermsOnChange(evt)} />
                            </li>
                        </ol>
                    </Col>
                    <Col lg={8} className="upload-file-list">

                    </Col>
                </Row>
            </Container>
        );
    }
}

export default Download;