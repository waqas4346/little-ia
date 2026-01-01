import { Component } from '@theme/component';

/**
 * Component to handle personalise button clicks and open the modal
 */
export class PersonaliseButtonComponent extends Component {
  requiredRefs = ['personaliseButton'];

  connectedCallback() {
    super.connectedCallback();
  }

  /**
   * Opens the personalise modal
   * @param {Event} event - The click event
   */
  openPersonaliseModal = (event) => {
    event.preventDefault();
    const dialog = document.querySelector('personalise-dialog');
    if (dialog) {
      dialog.showDialog();
    }
  };
}

customElements.define('personalise-button', PersonaliseButtonComponent);


