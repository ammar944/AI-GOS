import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion';

// ============================================================================
// AI-GOS — WITH SOUL
// Premium, crafted, memorable
// ============================================================================

// Animated number counter hook
const useCounter = (target, duration = 1500) => {
  const [value, setValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  
  useEffect(() => {
    if (hasAnimated) return;
    setHasAnimated(true);
    
    const startTime = Date.now();
    const startValue = 0;
    
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(startValue + (target - startValue) * eased));
      
      if (progress < 1) requestAnimationFrame(tick);
    };
    
    requestAnimationFrame(tick);
  }, [target, duration, hasAnimated]);
  
  return value;
};

// Premium typewriter
const useTypewriter = (text, speed = 8) => {
  const [displayed, setDisplayed] = useState('');
  
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    let i = 0;
    setDisplayed('');
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, ++i));
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  
  return { displayed, isComplete: displayed === text };
};

// ============================================================================
// GRAIN TEXTURE OVERLAY
// ============================================================================
const Grain = () => (
  <div style={{
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1000,
    opacity: 0.03,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
  }} />
);

// ============================================================================
// GRADIENT BORDER WRAPPER
// ============================================================================
const GradientBorder = ({ children, className, animate = false }) => (
  <div style={{
    position: 'relative',
    borderRadius: 16,
    padding: 1,
    background: animate 
      ? 'linear-gradient(135deg, rgba(59,130,246,0.5), rgba(139,92,246,0.3), rgba(59,130,246,0.1), rgba(139,92,246,0.5))'
      : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
    backgroundSize: animate ? '300% 300%' : '100% 100%',
    animation: animate ? 'gradientShift 8s ease infinite' : 'none',
  }}>
    <div style={{
      background: '#0a0a0a',
      borderRadius: 15,
      height: '100%',
    }}>
      {children}
    </div>
  </div>
);

// ============================================================================
// STAT CARD WITH COUNTER & GLOW
// ============================================================================
const StatCard = ({ value, label, suffix = '', delay = 0, icon }) => {
  const numericValue = parseInt(value.replace(/[^0-9]/g, '')) || 0;
  const prefix = value.match(/^[^0-9]*/)?.[0] || '';
  const counter = useCounter(numericValue, 2000 + delay);
  const [hovered, setHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay / 1000, ease: [0.21, 0.45, 0.27, 0.9] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{ position: 'relative' }}
    >
      {/* Glow on hover */}
      <motion.div
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute',
          inset: -20,
          background: 'radial-gradient(circle at center, rgba(59,130,246,0.15), transparent 70%)',
          borderRadius: 40,
          pointerEvents: 'none',
        }}
      />
      
      <div style={{
        padding: '32px 28px',
        position: 'relative',
      }}>
        {/* Icon */}
        <div style={{
          fontSize: 20,
          marginBottom: 16,
          opacity: 0.6,
        }}>
          {icon}
        </div>
        
        {/* Value */}
        <div style={{
          fontSize: 42,
          fontWeight: 700,
          fontFamily: '"Geist Mono", ui-monospace, monospace',
          letterSpacing: '-0.03em',
          background: 'linear-gradient(180deg, #ffffff 0%, #a0a0a0 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8,
        }}>
          {prefix}{counter.toLocaleString()}{suffix}
        </div>
        
        {/* Label */}
        <div style={{
          fontSize: 13,
          color: '#666',
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}>
          {label}
        </div>
        
        {/* Subtle line accent */}
        <motion.div
          animate={{ width: hovered ? '100%' : '40%' }}
          transition={{ duration: 0.4, ease: [0.21, 0.45, 0.27, 0.9] }}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 28,
            height: 1,
            background: 'linear-gradient(90deg, rgba(59,130,246,0.5), transparent)',
          }}
        />
      </div>
    </motion.div>
  );
};

// ============================================================================
// PREMIUM INPUT WITH FLOATING LABEL
// ============================================================================
const Input = ({ label, value, onChange, placeholder }) => {
  const [focused, setFocused] = useState(false);
  const hasValue = value && value.length > 0;
  
  return (
    <motion.div 
      style={{ marginBottom: 28, position: 'relative' }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {/* Floating label */}
      <motion.label
        animate={{
          y: focused || hasValue ? -24 : 0,
          scale: focused || hasValue ? 0.85 : 1,
          color: focused ? '#3b82f6' : '#666',
        }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'absolute',
          left: 0,
          top: 16,
          fontSize: 14,
          fontWeight: 500,
          pointerEvents: 'none',
          transformOrigin: 'left',
        }}
      >
        {label}
      </motion.label>
      
      <input
        type="text"
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '16px 0',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          color: '#fff',
          fontSize: 16,
          fontWeight: 400,
          outline: 'none',
          transition: 'border-color 0.3s',
          borderColor: focused ? '#3b82f6' : 'rgba(255,255,255,0.1)',
        }}
      />
      
      {/* Focus glow line */}
      <motion.div
        animate={{ scaleX: focused ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          transformOrigin: 'left',
        }}
      />
    </motion.div>
  );
};

// ============================================================================
// MAGNETIC BUTTON
// ============================================================================
const MagneticButton = ({ children, onClick, primary, loading }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const handleMouse = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.15);
    y.set((e.clientY - centerY) * 0.15);
  };
  
  const reset = () => {
    x.set(0);
    y.set(0);
  };
  
  return (
    <motion.button
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      disabled={loading}
      style={{
        x, y,
        position: 'relative',
        padding: primary ? '18px 36px' : '12px 24px',
        background: primary 
          ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 50%, #1d4ed8 100%)'
          : 'transparent',
        border: primary ? 'none' : '1px solid rgba(255,255,255,0.15)',
        borderRadius: 12,
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        cursor: loading ? 'wait' : 'pointer',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Shine effect */}
      {primary && (
        <motion.div
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.6 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            pointerEvents: 'none',
          }}
        />
      )}
      
      {/* Glow */}
      {primary && (
        <div style={{
          position: 'absolute',
          inset: -2,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          borderRadius: 14,
          filter: 'blur(20px)',
          opacity: 0.4,
          zIndex: -1,
        }} />
      )}
      
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
        {loading ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: 16,
              height: 16,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              display: 'inline-block',
            }}
          />
        ) : null}
        {children}
        {primary && !loading && <span style={{ marginLeft: 4 }}>→</span>}
      </span>
    </motion.button>
  );
};

// ============================================================================
// PIPELINE WITH ANIMATED CONNECTIONS
// ============================================================================
const Pipeline = ({ stages, current }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '20px 24px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      marginBottom: 24,
      gap: 8,
    }}
  >
    {stages.map((stage, i) => {
      const isComplete = i < current;
      const isActive = i === current;
      
      return (
        <React.Fragment key={stage}>
          <motion.div
            animate={{
              scale: isActive ? 1.05 : 1,
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              background: isActive 
                ? 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.1))'
                : isComplete
                  ? 'rgba(34,197,94,0.1)'
                  : 'transparent',
              borderRadius: 8,
              border: `1px solid ${
                isActive ? 'rgba(59,130,246,0.3)' 
                : isComplete ? 'rgba(34,197,94,0.2)' 
                : 'transparent'
              }`,
            }}
          >
            {/* Status dot with pulse */}
            <div style={{ position: 'relative' }}>
              <motion.div
                animate={{
                  background: isComplete ? '#22c55e' : isActive ? '#3b82f6' : '#333',
                }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                }}
              />
              {isActive && (
                <motion.div
                  animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: '#3b82f6',
                  }}
                />
              )}
            </div>
            
            <span style={{
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isComplete ? '#22c55e' : isActive ? '#fff' : '#666',
              fontFamily: '"Geist Mono", monospace',
            }}>
              {stage}
            </span>
          </motion.div>
          
          {/* Animated connection line */}
          {i < stages.length - 1 && (
            <div style={{ 
              width: 32, 
              height: 2, 
              background: '#222',
              borderRadius: 1,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <motion.div
                animate={{ 
                  x: isComplete ? '0%' : '-100%',
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, #22c55e, #22c55e)',
                }}
              />
            </div>
          )}
        </React.Fragment>
      );
    })}
  </motion.div>
);

// ============================================================================
// DOCUMENT EDITOR WITH SYNTAX HIGHLIGHTING
// ============================================================================
const DocumentEditor = ({ content, isStreaming }) => {
  const { displayed, isComplete } = useTypewriter(isStreaming ? content : '', 6);
  const text = isStreaming ? displayed : content;
  const lines = text ? text.split('\n') : [];
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayed, isStreaming]);
  
  // Syntax highlighting
  const highlightLine = (line) => {
    if (line.match(/^[A-Z][A-Z\s]+$/)) {
      return { color: '#fff', fontWeight: 700, fontSize: 14 };
    }
    if (line.startsWith('═') || line.startsWith('─')) {
      return { color: '#333' };
    }
    if (line.startsWith('•') || line.startsWith('□')) {
      return { color: '#a0a0a0' };
    }
    if (line.match(/^\d+\./)) {
      return { color: '#3b82f6' };
    }
    if (line.includes('%') || line.includes('$')) {
      return { color: '#22c55e' };
    }
    return { color: '#888' };
  };
  
  return (
    <GradientBorder animate={isStreaming}>
      <div style={{ borderRadius: 15, overflow: 'hidden' }}>
        {/* Window chrome */}
        <div style={{
          padding: '14px 20px',
          background: 'linear-gradient(180deg, #141414 0%, #0a0a0a 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
            </div>
            <div style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 6,
              fontSize: 12,
              color: '#666',
              fontFamily: '"Geist Mono", monospace',
            }}>
              blueprint.md
            </div>
          </div>
          
          {text && (
            <div style={{ fontSize: 11, color: '#444' }}>
              {lines.length} lines • {text.length} chars
            </div>
          )}
        </div>
        
        {/* Editor content */}
        <div
          ref={containerRef}
          style={{
            minHeight: 450,
            maxHeight: 550,
            overflowY: 'auto',
            background: '#0a0a0a',
          }}
        >
          {lines.length > 0 ? (
            <div style={{ display: 'flex' }}>
              {/* Line numbers */}
              <div style={{
                padding: '20px 0',
                paddingRight: 20,
                paddingLeft: 20,
                borderRight: '1px solid rgba(255,255,255,0.04)',
                fontFamily: '"Geist Mono", monospace',
                fontSize: 12,
                lineHeight: 1.8,
                color: '#333',
                textAlign: 'right',
                userSelect: 'none',
                background: 'rgba(255,255,255,0.01)',
              }}>
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              
              {/* Code */}
              <div style={{
                flex: 1,
                padding: 20,
                fontFamily: '"Geist Mono", monospace',
                fontSize: 13,
                lineHeight: 1.8,
              }}>
                {lines.map((line, i) => (
                  <div key={i} style={highlightLine(line)}>
                    {line || '\u00A0'}
                  </div>
                ))}
                
                {/* Cursor */}
                {isStreaming && !isComplete && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.4, repeat: Infinity }}
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 20,
                      background: 'linear-gradient(180deg, #3b82f6, #8b5cf6)',
                      borderRadius: 2,
                      marginLeft: 2,
                      verticalAlign: 'text-bottom',
                      boxShadow: '0 0 20px rgba(59,130,246,0.5)',
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div style={{
              height: 450,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#333',
            }}>
              <motion.div
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 4, repeat: Infinity }}
                style={{ fontSize: 48, marginBottom: 20, opacity: 0.5 }}
              >
                ✦
              </motion.div>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#666' }}>
                Ready to generate
              </div>
              <div style={{ fontSize: 13, color: '#444' }}>
                Fill in the briefing and click generate
              </div>
            </div>
          )}
        </div>
      </div>
    </GradientBorder>
  );
};

// ============================================================================
// AI CHAT PANEL - PREMIUM EDITION
// ============================================================================
const ChatPanel = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    { from: 'ai', text: 'I can help refine this blueprint. What would you like to adjust?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesRef = useRef(null);
  
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);
  
  const send = () => {
    if (!input.trim()) return;
    setMessages(m => [...m, { from: 'user', text: input }]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      setMessages(m => [...m, { 
        from: 'ai', 
        text: 'Done. I\'ve optimized the channel allocation based on your target audience profile. LinkedIn Ads now at 50% for better enterprise reach.' 
      }]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(8px)',
              zIndex: 100,
            }}
          />
          
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              bottom: 16,
              width: 400,
              zIndex: 101,
            }}
          >
            <GradientBorder>
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 15,
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  padding: '24px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 10, 
                        marginBottom: 6 
                      }}>
                        <span style={{ fontSize: 18 }}>✦</span>
                        <span style={{ fontSize: 16, fontWeight: 600 }}>AI Editor</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#666' }}>
                        Refine your blueprint with natural language
                      </div>
                    </div>
                    <motion.button
                      onClick={onClose}
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      style={{
                        width: 32,
                        height: 32,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: '#666',
                        cursor: 'pointer',
                        fontSize: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </motion.button>
                  </div>
                </div>
                
                {/* Messages */}
                <div
                  ref={messagesRef}
                  style={{
                    flex: 1,
                    padding: 20,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                  }}
                >
                  {messages.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                      }}
                    >
                      <div style={{
                        padding: '14px 18px',
                        background: m.from === 'user' 
                          ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
                          : 'rgba(255,255,255,0.05)',
                        border: m.from === 'ai' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        borderRadius: 16,
                        borderBottomRightRadius: m.from === 'user' ? 4 : 16,
                        borderBottomLeftRadius: m.from === 'ai' ? 4 : 16,
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: '#fff',
                      }}>
                        {m.text}
                      </div>
                    </motion.div>
                  ))}
                  
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      style={{
                        alignSelf: 'flex-start',
                        padding: '14px 18px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 16,
                        borderBottomLeftRadius: 4,
                      }}
                    >
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ 
                              y: [0, -6, 0],
                              opacity: [0.4, 1, 0.4],
                            }}
                            transition={{ 
                              duration: 0.8,
                              repeat: Infinity,
                              delay: i * 0.15,
                            }}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
                
                {/* Input */}
                <div style={{
                  padding: 20,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  <div style={{
                    display: 'flex',
                    gap: 10,
                    padding: 8,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                  }}>
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && send()}
                      placeholder="Describe changes..."
                      style={{
                        flex: 1,
                        padding: '12px 14px',
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: 14,
                        outline: 'none',
                      }}
                    />
                    <motion.button
                      onClick={send}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        padding: '12px 20px',
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        border: 'none',
                        borderRadius: 10,
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Send
                    </motion.button>
                  </div>
                  
                  <div style={{
                    marginTop: 12,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}>
                    {['Adjust budget', 'Add channel', 'Change target'].map(suggestion => (
                      <motion.button
                        key={suggestion}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setInput(suggestion)}
                        style={{
                          padding: '6px 12px',
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 20,
                          color: '#666',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {suggestion}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </GradientBorder>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

export default function AIGOSWithSoul() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState(-1);
  const [blueprint, setBlueprint] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  
  const [form, setForm] = useState({
    company: 'SaaSLaunch',
    market: 'B2B SaaS founders',
    budget: '50000',
  });

  const stages = ['Extract', 'Research', 'Analyze', 'Generate'];
  
  const sampleOutput = `STRATEGIC MARKETING BLUEPRINT
══════════════════════════════════════════════════════════════════════


EXECUTIVE SUMMARY
───────────────────────────────────────────────────────────────────────

Target Audience    B2B SaaS founders & marketing leaders
Monthly Budget     $50,000
Primary Goal       Lead generation & sustainable pipeline growth
Timeline           90-day implementation roadmap


MARKET INTELLIGENCE
───────────────────────────────────────────────────────────────────────

• Total Addressable Market: $847B globally (2024)
• Compound Growth Rate: 18.7% through 2028
• Target Segment: Mid-market, $10K-50K ACV
• Competitive Landscape: Fragmented, high opportunity


CHANNEL ALLOCATION
───────────────────────────────────────────────────────────────────────

1. LinkedIn Advertising                    45%        $22,500/mo
   Decision-maker targeting, ABM campaigns
   Expected CPL: $85-120

2. Content & SEO                          30%        $15,000/mo
   Thought leadership, comparison content
   6-month compound growth target

3. Strategic Partnerships                  25%        $12,500/mo
   Integration marketplace presence
   Co-marketing with complementary tools


PERFORMANCE TARGETS
───────────────────────────────────────────────────────────────────────

□ MQLs Generated         150/month        +60% from baseline
□ Customer Acquisition   $850             -15% reduction target  
□ Pipeline Value         $450K/quarter    New qualified opps
□ Demo Conversion        3.2%             Industry benchmark


IMPLEMENTATION ROADMAP
───────────────────────────────────────────────────────────────────────

Week 1-2    Discovery & ICP documentation
Week 3-4    Campaign architecture & creative
Week 5-6    Launch LinkedIn pilot
Week 7-8    Content calendar execution
Week 9+     Optimize & scale winning channels`;

  const generate = () => {
    setIsGenerating(true);
    setBlueprint('');
    setCurrentStage(0);
    
    setTimeout(() => setCurrentStage(1), 2000);
    setTimeout(() => setCurrentStage(2), 4500);
    setTimeout(() => setCurrentStage(3), 6000);
    setTimeout(() => {
      setBlueprint(sampleOutput);
      setCurrentStage(4);
      setIsGenerating(false);
    }, 6500);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      color: '#fff',
      fontFamily: '"Geist Sans", -apple-system, BlinkMacSystemFont, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Inject Geist font */}
      <style>{`
        @import url('https://fonts.cdnfonts.com/css/geist-mono');
        @import url('https://fonts.cdnfonts.com/css/geist-sans');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: #3b82f6; color: #fff; }
        
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #333; }
        
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
      
      {/* Grain overlay */}
      <Grain />
      
      {/* Ambient glow */}
      <div style={{
        position: 'fixed',
        top: -300,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 1000,
        height: 600,
        background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />
      
      {/* Header */}
      <header style={{
        padding: '20px 48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 10,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <motion.div 
          style={{ display: 'flex', alignItems: 'center', gap: 14 }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{
            width: 36,
            height: 36,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 700,
          }}>
            ✦
          </div>
          <span style={{ 
            fontWeight: 600, 
            fontSize: 18,
            letterSpacing: '-0.02em',
          }}>
            AI-GOS
          </span>
          <span style={{
            padding: '4px 10px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,130,246,0.1))',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: 6,
            fontSize: 10,
            fontWeight: 600,
            color: '#a78bfa',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Beta
          </span>
        </motion.div>
        
        {/* Nav */}
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: 4,
          }}
        >
          {['Dashboard', 'Blueprints', 'Campaigns', 'Settings'].map((item, i) => (
            <motion.button
              key={item}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              style={{
                padding: '10px 18px',
                background: i === 1 ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none',
                borderRadius: 9,
                color: i === 1 ? '#fff' : '#666',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {item}
            </motion.button>
          ))}
        </motion.nav>
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <MagneticButton onClick={() => setChatOpen(true)}>
            ⌘K Edit
          </MagneticButton>
        </motion.div>
      </header>
      
      {/* Main */}
      <main style={{ maxWidth: 1300, margin: '0 auto', padding: '56px 48px' }}>
        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 1,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 64,
          }}
        >
          <div style={{ background: '#0a0a0a' }}>
            <StatCard value="24" label="Total Blueprints" icon="📄" delay={0} />
          </div>
          <div style={{ background: '#0a0a0a' }}>
            <StatCard value="8" label="Active Campaigns" icon="🚀" delay={100} />
          </div>
          <div style={{ background: '#0a0a0a' }}>
            <StatCard value="1200000" suffix="" label="Total Reach" icon="👁" delay={200} />
          </div>
          <div style={{ background: '#0a0a0a' }}>
            <StatCard value="$0" suffix=".11" label="Avg. Cost" icon="⚡" delay={300} />
          </div>
        </motion.div>
        
        {/* Main Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '380px 1fr',
          gap: 56,
          alignItems: 'start',
        }}>
          {/* Left: Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <h1 style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              marginBottom: 8,
              background: 'linear-gradient(180deg, #fff 0%, #888 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              New Blueprint
            </h1>
            <p style={{
              fontSize: 15,
              color: '#666',
              marginBottom: 40,
              lineHeight: 1.6,
            }}>
              Enter your briefing to generate a comprehensive marketing strategy.
            </p>
            
            <Input
              label="Company Name"
              value={form.company}
              onChange={(e) => setForm({...form, company: e.target.value})}
            />
            <Input
              label="Target Market"
              value={form.market}
              onChange={(e) => setForm({...form, market: e.target.value})}
            />
            <Input
              label="Monthly Budget (USD)"
              value={form.budget}
              onChange={(e) => setForm({...form, budget: e.target.value})}
            />
            
            <div style={{ marginTop: 40 }}>
              <MagneticButton primary onClick={generate} loading={isGenerating}>
                {isGenerating ? 'Generating' : 'Generate Blueprint'}
              </MagneticButton>
            </div>
          </motion.div>
          
          {/* Right: Output */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}>
              <h2 style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#444',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}>
                Output
              </h2>
              
              {blueprint && !isGenerating && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <MagneticButton>Copy</MagneticButton>
                  <MagneticButton>Export</MagneticButton>
                  <MagneticButton onClick={() => setChatOpen(true)}>AI Edit</MagneticButton>
                </div>
              )}
            </div>
            
            {currentStage >= 0 && (
              <Pipeline stages={stages} current={currentStage} />
            )}
            
            <DocumentEditor
              content={blueprint}
              isStreaming={isGenerating && currentStage === 3}
            />
          </motion.div>
        </div>
      </main>
      
      {/* Chat */}
      <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
