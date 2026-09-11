/**
 * Minimal Global Application State.
 * Feature-specific state remains strictly encapsulated within its respective module.
 */
export const state = {
  currentUser: null,
  activeTab: "cases",
  currentCase: null,
  currentCreditState: null,
};

export function setCurrentUser(user) {
  state.currentUser = user;
}

export function setActiveTab(tab) {
  state.activeTab = tab;
}

export function setCurrentCase(caseData) {
  state.currentCase = caseData;
}

export function setCurrentCreditState(credits) {
  state.currentCreditState = credits;
}
