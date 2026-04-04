import { Component } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertTriangle, FiHome, FiRefreshCw } from 'react-icons/fi';

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[RouteErrorBoundary] ${this.props.routeName || 'route'} crashed`, error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    const { children, routeName = 'This route' } = this.props;
    const { error } = this.state;

    if (!error) {
      return children;
    }

    return (
      <div className="app-error-boundary">
        <div className="app-error-boundary__panel">
          <div className="app-error-boundary__icon">
            <FiAlertTriangle />
          </div>
          <span className="app-error-boundary__eyebrow">Route safeguard</span>
          <h2>{routeName} hit a rendering problem.</h2>
          <p>
            The app caught the error before the full workspace blanked out. You can retry this route
            or move back to the front page.
          </p>
          <code className="app-error-boundary__message">{error.message || 'Unknown rendering error'}</code>

          <div className="app-error-boundary__actions">
            <button
              type="button"
              className="app-error-boundary__button app-error-boundary__button--primary"
              onClick={this.handleRetry}
            >
              <FiRefreshCw />
              Retry route
            </button>
            <Link className="app-error-boundary__button" to="/">
              <FiHome />
              Go to front page
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
