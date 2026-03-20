// ============================================================
//  SDUCS – MK  |  Payment Page (Razorpay + UPI Fallback)
// ============================================================
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../utils/api";
import "./Payment.css";

const PLAN_INFO = {
  lite:    { label: "Lite",    data: "5 GB",  price: 25,  days: 2,  color: "#60a5fa" },
  premium: { label: "Premium", data: "10 GB", price: 49,  days: 4,  color: "#34d399" },
  pro:     { label: "Pro",     data: "20 GB", price: 99,  days: 6,  color: "#f59e0b" },
  promax:  { label: "Pro Max", data: "50 GB", price: 200, days: 8,  color: "#f472b6" },
};

export default function Payment() {
  const { plan } = useParams();
  const navigate = useNavigate();
  const planInfo = PLAN_INFO[plan];

  const [method, setMethod] = useState("razorpay"); // "razorpay" | "upi"
  const [order, setOrder] = useState(null);
  const [fallback, setFallback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [step, setStep] = useState("choose"); // "choose" | "qr" | "submit" | "success"

  // UTR + screenshot
  const [utr, setUtr] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();
  const timerRef = useRef();

  if (!planInfo) return <div className="pay-error">Invalid plan. <button onClick={() => navigate("/plans")}>Go back</button></div>;

  const startTimer = (seconds) => {
    setTimer(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const initiateRazorpay = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/payments/create-order", { plan });
      setOrder(data);
      setStep("qr");
      startTimer(30 * 60); // 30 min

      // Try to load Razorpay SDK and open checkout
      if (window.Razorpay) {
        const rzp = new window.Razorpay({
          key: data.razorpayKeyId,
          amount: data.amount * 100,
          currency: "INR",
          name: "SDUCS-MK",
          description: `${planInfo.label} Plan – ${planInfo.data}`,
          order_id: data.orderId,
          handler: async (response) => {
            try {
              await api.post("/payments/verify", response);
              setStep("success");
            } catch { alert("Payment verification failed. Contact support."); }
          },
          prefill: {},
          theme: { color: planInfo.color },
        });
        rzp.open();
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create order.");
    } finally {
      setLoading(false);
    }
  };

  const initiateUPI = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/payments/upi-fallback/initiate", { plan });
      setFallback(data);
      setStep("qr");
      startTimer(30 * 60);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to initiate payment.");
    } finally {
      setLoading(false);
    }
  };

  const submitScreenshot = async () => {
    if (!screenshot) return alert("Please select a payment screenshot.");
    setSubmitting(true);
    const fd = new FormData();
    fd.append("transactionId", fallback.transactionId);
    fd.append("screenshot", screenshot);
    if (utr) fd.append("utrNumber", utr);
    try {
      await api.post("/payments/upi-fallback/submit", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setStep("success");
    } catch (err) {
      alert(err.response?.data?.error || "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return (
    <div className="payment-page">
      <div className="pay-card">
        {/* Plan Summary */}
        <div className="pay-plan-bar" style={{ borderColor: planInfo.color }}>
          <div>
            <span className="ppb-name" style={{ color: planInfo.color }}>{planInfo.label} Plan</span>
            <span className="ppb-data">{planInfo.data} · {planInfo.days} days</span>
          </div>
          <span className="ppb-price">₹{planInfo.price}</span>
        </div>

        {/* Step: Choose method */}
        {step === "choose" && (
          <div className="pay-methods">
            <h2 className="pay-title">Choose Payment Method</h2>

            <button
              className={`pm-option ${method === "razorpay" ? "selected" : ""}`}
              onClick={() => setMethod("razorpay")}
            >
              <div className="pm-radio"><div className={method === "razorpay" ? "radio-fill" : ""} /></div>
              <div className="pm-info">
                <strong>Razorpay (Recommended)</strong>
                <span>UPI, Cards, Net Banking — Instant verification</span>
              </div>
              <span className="pm-badge instant">Instant</span>
            </button>

            <button
              className={`pm-option ${method === "upi" ? "selected" : ""}`}
              onClick={() => setMethod("upi")}
            >
              <div className="pm-radio"><div className={method === "upi" ? "radio-fill" : ""} /></div>
              <div className="pm-info">
                <strong>Manual UPI Transfer</strong>
                <span>Scan QR → Pay → Upload screenshot</span>
              </div>
              <span className="pm-badge manual">2-4 hrs</span>
            </button>

            <button
              className="pay-proceed-btn"
              style={{ background: `linear-gradient(135deg, ${planInfo.color}bb, ${planInfo.color})` }}
              onClick={method === "razorpay" ? initiateRazorpay : initiateUPI}
              disabled={loading}
            >
              {loading ? "⏳ Processing…" : `Pay ₹${planInfo.price}`}
            </button>
          </div>
        )}

        {/* Step: QR Code */}
        {step === "qr" && (
          <div className="pay-qr-step">
            <h2 className="pay-title">
              {method === "razorpay" ? "Scan QR to Pay" : "Scan & Pay via UPI"}
            </h2>

            {timer > 0 && (
              <div className="pay-timer">
                <span className="timer-label">QR expires in</span>
                <span className="timer-val">{formatTimer(timer)}</span>
              </div>
            )}

            <div className="qr-wrapper">
              <img
                src={(order || fallback)?.qrCode}
                alt="Payment QR"
                className="qr-img"
              />
              <p className="qr-amount">₹{planInfo.price}</p>
            </div>

            {method === "upi" && (
              <>
                <div className="upi-steps">
                  {fallback?.instructions?.map((instr, i) => (
                    <div key={i} className="upi-step">
                      <span className="us-num">{i + 1}</span>
                      <span>{instr}</span>
                    </div>
                  ))}
                </div>
                <button className="pay-proceed-btn mt16" onClick={() => setStep("submit")}>
                  I've Paid → Upload Screenshot
                </button>
              </>
            )}

            {method === "razorpay" && (
              <p className="rp-note">If the Razorpay window didn't open, reload or use manual UPI.</p>
            )}
          </div>
        )}

        {/* Step: Upload Screenshot */}
        {step === "submit" && (
          <div className="pay-screenshot-step">
            <h2 className="pay-title">Upload Payment Proof</h2>
            <p className="pay-sub">Upload your UPI payment confirmation screenshot.</p>

            <div className="ss-upload" onClick={() => fileRef.current.click()}>
              <input type="file" accept="image/*" ref={fileRef} style={{ display:"none" }} onChange={e => setScreenshot(e.target.files[0])} />
              {screenshot ? (
                <div className="ss-preview">
                  <img src={URL.createObjectURL(screenshot)} alt="screenshot" />
                  <span>{screenshot.name}</span>
                </div>
              ) : (
                <div className="ss-placeholder">
                  <span>📸</span>
                  <span>Click to select screenshot</span>
                </div>
              )}
            </div>

            <div className="field-wrap mt16">
              <label>UTR / Transaction ID (optional but recommended)</label>
              <input className="utr-input" placeholder="e.g. 123456789012" value={utr} onChange={e => setUtr(e.target.value)} />
            </div>

            <button className="pay-proceed-btn mt16" onClick={submitScreenshot} disabled={submitting || !screenshot}>
              {submitting ? "Submitting…" : "Submit for Verification"}
            </button>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div className="pay-success">
            <div className="success-icon">✅</div>
            <h2>{method === "razorpay" ? "Payment Successful!" : "Submission Received!"}</h2>
            <p>
              {method === "razorpay"
                ? `Your ${planInfo.label} plan has been activated with ${planInfo.data} data!`
                : `We've received your screenshot. Your plan will be activated within 2-4 hours after verification.`}
            </p>
            <button className="pay-proceed-btn mt16" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
