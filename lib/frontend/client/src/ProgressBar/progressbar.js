import React, { Component } from 'react';
import isEqual from 'lodash/isEqual';
import ProgressBar from 'progressbar.js';

class Shape extends Component {
  static defaultProps = {
    ShapeClass: null,
    options: {},
    progress: 0,
    text: null,
    initialAnimate: false,
    containerStyle: {},
    containerClassName: 'progressbar-container',
  };

  shape;

  progressBar = React.createRef();

  create(props, oldProps) {
    if (this.shape) {
      return;
    }

    // setState function is not used to prevent a new render cycle
    // This handling happens outside of React component's lifecycle
    const container = this.progressBar.current;
    this.shape = new props.ShapeClass(container, props.options);
    if (props.initialAnimate) {
      if (oldProps) {
        this.setProgress(oldProps.progress);
      }

      this.animateProgress(props.progress);
    } else {
      this.setProgress(props.progress);
    }

    this.setText(props.text);
  }

  destroy() {
    if (this.shape) {
      this.shape.destroy();
      this.shape = null;
    }
  }

  animateProgress(progress) {
    this.shape.animate(progress);
  }

  setProgress(progress) {
    this.shape.set(progress);
  }

  setText(text) {
    if (text) {
      this.shape.setText(text);
    }
  }

  componentDidUpdate(prevProps) {
    if (!isEqual(this.props.options, prevProps.options)) {
      this.destroy();
      this.create(this.props, prevProps);
    }
    this.animateProgress(this.props.progress);
    this.setText(this.props.text);
  }

  componentDidMount() {
    this.create(this.props, null);
  }

  componentWillUnmount() {
    this.destroy();
  }

  render() {
    const { style, containerClassName } = this.props;
    return <div className={containerClassName} style={style} ref={this.progressBar} />;
  }
}

class Line extends Component {
  render() {
    return <Shape {...this.props} ShapeClass={ProgressBar.Line} />;
  }
}

class Circle extends Component {
  render() {
    return <Shape {...this.props} ShapeClass={ProgressBar.Circle} />;
  }
}

class SemiCircle extends Component {
  render() {
    return <Shape {...this.props} ShapeClass={ProgressBar.SemiCircle} />;
  }
}

export default {
  Line,
  Circle,
  SemiCircle,
};