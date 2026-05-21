import React from 'react';
import classNames from 'classnames';
import './Timer.scss';

interface TimerProps {
  seconds: number;
  total: number;
}

export default function Timer({ seconds, total }: TimerProps) {
  const ratio = seconds / total;
  const isUrgent = ratio <= 0.33;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference * (1 - ratio);

  return (
    <div className={classNames('timer', { 'timer--urgent': isUrgent })}>
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r="28" className="timer__track" />
        <circle
          cx="36"
          cy="36"
          r="28"
          className="timer__progress"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <span className="timer__value">{seconds}</span>
    </div>
  );
}
