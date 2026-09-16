/**
 * In-memory session manager with history stack for full reversibility.
 */

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Get or initialize session for a user.
   * @param {number|string} userId
   */
  getSession(userId) {
    const key = String(userId);
    if (!this.sessions.has(key)) {
      this.sessions.set(key, this._createEmptySession());
    }
    return this.sessions.get(key);
  }

  _createEmptySession() {
    return {
      step: 'IDLE',
      data: {
        qrData: null,
        photoBuffer: null,
        lineCount: null, // 1 or 2
        line1: '',
        line2: '',
      },
      history: [], // Stack of previous snapshots { step, data }
    };
  }

  /**
   * Updates session data without changing step.
   */
  updateData(userId, partialData) {
    const session = this.getSession(userId);
    session.data = {
      ...session.data,
      ...partialData,
    };
    return session;
  }

  /**
   * Transition to a new step, pushing current step & state to history.
   * @param {number|string} userId
   * @param {string} newStep
   * @param {object} [partialData]
   */
  transition(userId, newStep, partialData = {}) {
    const session = this.getSession(userId);

    // Push snapshot to history for backward navigation
    session.history.push({
      step: session.step,
      data: { ...session.data },
    });

    if (partialData && Object.keys(partialData).length > 0) {
      session.data = {
        ...session.data,
        ...partialData,
      };
    }

    session.step = newStep;
    return session;
  }

  /**
   * Reverses to the previous step.
   * @param {number|string} userId
   * @returns {object|null} Returns previous session state, or null if cannot go back.
   */
  stepBack(userId) {
    const session = this.getSession(userId);
    if (session.history.length === 0) {
      this.reset(userId);
      return null;
    }

    const previous = session.history.pop();
    session.step = previous.step;
    session.data = previous.data;
    return session;
  }

  /**
   * Clears session back to initial IDLE state.
   */
  reset(userId) {
    const key = String(userId);
    this.sessions.set(key, this._createEmptySession());
    return this.sessions.get(key);
  }
}

export const sessionManager = new SessionManager();
