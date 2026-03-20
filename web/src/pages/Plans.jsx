// ============================================================
//  SDUCS – MK  |  Plans Page
// ============================================================
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Plans.css";

const PLANS = [
  { id: "lite",    label: "Lite",    data: "5 GB",  price: 25,  days: 2,  color: "#60a5fa", features: ["5 GB download data", "2-day validity", "Priority support"] },
  { id: "premium", label: "Premium", data: "10 GB", price: 49,  days: 4,  color: "#34d399", features: ["10 GB download data", "4-day validity", "Fast downloads", "Priority support"], popular: true },
  { id: "pro",     label: "Pro",     data: "20 GB", price: 99,  days: 6,  color: "#f59e0b", features: ["20 GB download data", "6-day validity", "Unlimited speed", "AI features", "Priority support"] },
  { id: "promax",  label: "Pro Max", data: "50 GB", price: 200, days: 8,  color: "#f472b6", features: ["50 GB download data", "8-day validity", "Unlimited speed", "All AI features", "Dedicated support", "Early access"] },
];

export default function Plans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentPlan = user?.subscription?.plan;

  return (
    <div className="plans-page">
      <div className="plans-header">
        <h1>Upgrade Your Plan</h1>
        <p>Get more download data. All plans include unlimited cloud storage rewards via ads.</p>
      </div>

      <div className="plans-grid">
        {PLANS.map(plan => (
          <div key={plan.id} className={`plan-card ${plan.popular ? "popular" : ""} ${currentPlan === plan.id ? "current" : ""}`}
               style={{ "--plan-color": plan.color }}>
            {plan.popular && <div className="pop-badge">Most Popular</div>}
            {currentPlan === plan.id && <div className="cur-badge">Current Plan</div>}

            <div className="pc-header">
              <h3 className="pc-name" style={{ color: plan.color }}>{plan.label}</h3>
              <div className="pc-price">
                <span className="pc-inr">₹</span>
                <span className="pc-amount">{plan.price}</span>
                <span className="pc-period">/{plan.days} days</span>
              </div>
              <div className="pc-data">{plan.data} Download Data</div>
            </div>

            <ul className="pc-features">
              {plan.features.map(f => (
                <li key={f}><span className="check" style={{ color: plan.color }}>✓</span>{f}</li>
              ))}
            </ul>

            <button
              className="pc-btn"
              style={{ background: `linear-gradient(135deg, ${plan.color}cc, ${plan.color})` }}
              onClick={() => navigate(`/payment/${plan.id}`)}
              disabled={currentPlan === plan.id}
            >
              {currentPlan === plan.id ? "Active" : "Get Started"}
            </button>
          </div>
        ))}
      </div>

      <div className="plans-note">
        <h3>💡 Free Storage via Ads</h3>
        <p>You can also earn <strong>100–500 MB</strong> of cloud storage per ad view (up to <strong>2 GB/day</strong>) completely free from your dashboard!</p>
      </div>
    </div>
  );
}
