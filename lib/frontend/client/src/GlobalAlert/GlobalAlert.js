import React, { Component } from 'react';

import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';

class GlobalAlert extends Component {
    constructor(props) {
      super(props);
  
      this.state = { show: false,
                      title: 'message title',
                      message: 'content of the message',
                      variant: 'success',
                      buttonVarian: 'outline-success',
                      buttonText: 'OK'
                    };
    
       this.handleHide = this.handleHide.bind(this);
       this.handleShow = this.handleShow.bind(this);
       this.showMessage = this.showMessage.bind(this);
    }
  
    handleHide() {
      this.setState({ show: false });
    }
  
    handleShow() {
      this.setState({ show: true });
    }
  
    showMessage(title, message, variant) {
      this.setState({
        title: title,
        message: message,
        variant: variant,
        buttonVariant: 'outline-' + variant
      });
      this.handleShow();
    }
  
    render() {
      return (
        <>
          <Alert show={this.state.show} variant={this.state.variant}>            
            <Alert.Heading>{this.state.title}</Alert.Heading>
            <p>
              {this.state.message}
            </p>
            <div className="d-flex justify-content-end">
            <Button onClick={ () => this.handleHide()} variant={this.state.buttonVariant}>{this.state.buttonText}</Button>
          </div>
          </Alert>
        </>
      );
    }
  };

  export default GlobalAlert;
  