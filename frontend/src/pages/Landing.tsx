import { Link } from 'react-router-dom'
import '../styles/landing.css'

export default function Landing() {
  return (
    <div className="landing-page">
      <div className="landing-background"></div>
      <div className="animated-background">
        <div className="floating-data-point" style={{ left: '10%', animationDelay: '0s' }}></div>
        <div className="floating-data-point" style={{ left: '20%', animationDelay: '2s' }}></div>
        <div className="floating-data-point" style={{ left: '30%', animationDelay: '4s' }}></div>
        <div className="floating-data-point" style={{ left: '40%', animationDelay: '1s' }}></div>
        <div className="floating-data-point" style={{ left: '50%', animationDelay: '3s' }}></div>
        <div className="floating-data-point" style={{ left: '60%', animationDelay: '5s' }}></div>
        <div className="floating-data-point" style={{ left: '70%', animationDelay: '2.5s' }}></div>
        <div className="floating-data-point" style={{ left: '80%', animationDelay: '4.5s' }}></div>
        <div className="floating-data-point" style={{ left: '90%', animationDelay: '1.5s' }}></div>
        
        <div className="graph-line" style={{ left: '15%', animationDelay: '0s' }}></div>
        <div className="graph-line" style={{ left: '45%', animationDelay: '3s' }}></div>
        <div className="graph-line" style={{ left: '75%', animationDelay: '6s' }}></div>
        
        <div className="floating-number" style={{ left: '12%', top: '20%', animationDelay: '0s' }}>42</div>
        <div className="floating-number" style={{ left: '35%', top: '60%', animationDelay: '2s' }}>π</div>
        <div className="floating-number" style={{ left: '68%', top: '30%', animationDelay: '4s' }}>Σ</div>
        <div className="floating-number" style={{ left: '85%', top: '70%', animationDelay: '1s' }}>∞</div>
        <div className="floating-number" style={{ left: '18%', top: '45%', animationDelay: '3s' }}>μ</div>
        <div className="floating-number" style={{ left: '42%', top: '25%', animationDelay: '5s' }}>σ</div>
        <div className="floating-number" style={{ left: '58%', top: '65%', animationDelay: '1.5s' }}>∫</div>
        <div className="floating-number" style={{ left: '75%', top: '15%', animationDelay: '3.5s' }}>√</div>
        <div className="floating-number" style={{ left: '28%', top: '75%', animationDelay: '2.5s' }}>∑</div>
        <div className="floating-number" style={{ left: '52%', top: '40%', animationDelay: '4.5s' }}>∏</div>
        <div className="floating-number" style={{ left: '88%', top: '50%', animationDelay: '1.2s' }}>%</div>
        <div className="floating-number" style={{ left: '15%', top: '80%', animationDelay: '3.2s' }}>±</div>
        <div className="floating-number" style={{ left: '38%', top: '10%', animationDelay: '5.2s' }}>≈</div>
        <div className="floating-number" style={{ left: '62%', top: '55%', animationDelay: '2.2s' }}>≠</div>
        <div className="floating-number" style={{ left: '78%', top: '85%', animationDelay: '4.2s' }}>≤</div>
        <div className="floating-number" style={{ left: '22%', top: '35%', animationDelay: '1.8s' }}>≥</div>
        <div className="floating-number" style={{ left: '48%', top: '75%', animationDelay: '3.8s' }}>α</div>
        <div className="floating-number" style={{ left: '72%', top: '5%', animationDelay: '5.8s' }}>β</div>
        <div className="floating-number" style={{ left: '92%', top: '25%', animationDelay: '2.8s' }}>θ</div>
        <div className="floating-number" style={{ left: '8%', top: '55%', animationDelay: '4.8s' }}>λ</div>
        
        <div className="chart-bar" style={{ left: '25%', animationDelay: '1s' }}></div>
        <div className="chart-bar" style={{ left: '55%', animationDelay: '3.5s' }}></div>
        <div className="chart-bar" style={{ left: '82%', animationDelay: '5.5s' }}></div>
        <div className="chart-bar" style={{ left: '32%', animationDelay: '2.3s' }}></div>
        <div className="chart-bar" style={{ left: '65%', animationDelay: '4.8s' }}></div>
        
        <div className="data-grid" style={{ left: '20%', top: '15%', animationDelay: '0s' }}></div>
        <div className="data-grid" style={{ left: '60%', top: '50%', animationDelay: '3s' }}></div>
        <div className="data-grid" style={{ left: '45%', top: '80%', animationDelay: '6s' }}></div>
        
        <div className="floating-symbol" style={{ left: '25%', top: '12%', animationDelay: '1.3s' }}>+</div>
        <div className="floating-symbol" style={{ left: '55%', top: '42%', animationDelay: '3.7s' }}>×</div>
        <div className="floating-symbol" style={{ left: '82%', top: '72%', animationDelay: '5.9s' }}>=</div>
        <div className="floating-symbol" style={{ left: '18%', top: '52%', animationDelay: '2.1s' }}>÷</div>
        <div className="floating-symbol" style={{ left: '48%', top: '22%', animationDelay: '4.3s' }}>&lt;</div>
        <div className="floating-symbol" style={{ left: '72%', top: '62%', animationDelay: '1.7s' }}>&gt;</div>
        <div className="floating-symbol" style={{ left: '38%', top: '32%', animationDelay: '3.9s' }}>$</div>
        <div className="floating-symbol" style={{ left: '68%', top: '82%', animationDelay: '5.1s' }}>#</div>
        <div className="floating-symbol" style={{ left: '15%', top: '62%', animationDelay: '2.7s' }}>@</div>
        <div className="floating-symbol" style={{ left: '88%', top: '32%', animationDelay: '4.5s' }}>→</div>
        <div className="floating-symbol" style={{ left: '32%', top: '92%', animationDelay: '1.9s' }}>↑</div>
        <div className="floating-symbol" style={{ left: '58%', top: '8%', animationDelay: '3.3s' }}>↓</div>
      </div>
      
      <div className="landing-content">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-badge">
            <span className="badge-icon">✨</span>
            <span>Powered by Google Gemini AI</span>
          </div>
          <h1 className="landing-title">
            <span className="title-glow">ORION</span>
            <span className="title-main">DATA ANALYZER</span>
          </h1>
          <p className="hero-subtitle">
            Transform your data into insights with AI-powered analysis. Ask questions in plain English and get instant visualizations.
          </p>
          <div className="hero-cta">
            <Link to="/app" className="cta-button primary">
              <span className="button-text">Get Started Free</span>
              <span className="button-glow"></span>
            </Link>
            <button className="cta-button secondary">
              <span className="button-text">Watch Demo</span>
            </button>
          </div>
          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">10K+</div>
              <div className="stat-label">Analyses</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">5K+</div>
              <div className="stat-label">Users</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">99%</div>
              <div className="stat-label">Accuracy</div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <div className="section-header">
            <h2 className="section-title">Why Choose Orion?</h2>
            <p className="section-subtitle">Everything you need to analyze data like a pro</p>
          </div>
          <div className="landing-features">
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>AI-Powered Analysis</h3>
              <p>Advanced AI automatically suggests the best visualizations and insights for your data</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>Natural Language</h3>
              <p>Ask questions in plain English - no coding or complex queries required</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Rich Visualizations</h3>
              <p>Histograms, box plots, correlations, and 10+ chart types automatically generated</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>Lightning Fast</h3>
              <p>Get insights in seconds with our powerful AI engine powered by Google Gemini</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Privacy First</h3>
              <p>Your data stays on your device. No cloud storage, no data sharing</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Easy to Use</h3>
              <p>Intuitive interface designed for everyone - from beginners to data scientists</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="how-it-works">
          <div className="section-header">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Get insights in three simple steps</p>
          </div>
          <div className="steps-container">
            <div className="step-item">
              <div className="step-number">1</div>
              <div className="step-icon">📁</div>
              <h3>Upload Your Data</h3>
              <p>Upload CSV or Excel files. Our AI automatically detects columns and data types</p>
            </div>
            <div className="step-connector"></div>
            <div className="step-item">
              <div className="step-number">2</div>
              <div className="step-icon">💭</div>
              <h3>Ask Questions</h3>
              <p>Type your questions in natural language. "What's the average sales by region?"</p>
            </div>
            <div className="step-connector"></div>
            <div className="step-item">
              <div className="step-number">3</div>
              <div className="step-icon">📈</div>
              <h3>Get Insights</h3>
              <p>Receive instant visualizations, charts, and AI-generated insights</p>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="use-cases">
          <div className="section-header">
            <h2 className="section-title">Perfect For</h2>
            <p className="section-subtitle">Whether you're a business analyst, researcher, or student</p>
          </div>
          <div className="use-cases-grid">
            <div className="use-case-card">
              <div className="use-case-icon">📊</div>
              <h3>Business Analytics</h3>
              <p>Analyze sales data, customer behavior, and market trends</p>
            </div>
            <div className="use-case-card">
              <div className="use-case-icon">🔬</div>
              <h3>Research</h3>
              <p>Process experimental data and generate publication-ready visualizations</p>
            </div>
            <div className="use-case-card">
              <div className="use-case-icon">📚</div>
              <h3>Education</h3>
              <p>Learn data analysis with interactive AI-powered guidance</p>
            </div>
            <div className="use-case-card">
              <div className="use-case-icon">💼</div>
              <h3>Reporting</h3>
              <p>Create professional reports and presentations quickly</p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Transform Your Data?</h2>
            <p className="cta-description">Join thousands of users who are already using Orion to make data-driven decisions</p>
            <Link to="/app" className="cta-button primary large">
              <span className="button-text">Start Analyzing Now</span>
              <span className="button-glow"></span>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Orion</h4>
              <p>AI-Powered Data Analysis Platform</p>
            </div>
            <div className="footer-section">
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Features</a></li>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="#use-cases">Use Cases</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Resources</h4>
              <ul>
                <li><a href="#docs">Documentation</a></li>
                <li><a href="#support">Support</a></li>
                <li><a href="#blog">Blog</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Legal</h4>
              <ul>
                <li><a href="#privacy">Privacy</a></li>
                <li><a href="#terms">Terms</a></li>
                <li><a href="#security">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>Powered by Google Gemini • Built for Data Analysts</p>
            <p className="copyright">© 2024 Orion Data Analyzer. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
