import { DialogComponent } from '@theme/dialog';

/**
 * A custom element that manages the size guide modal.
 *
 * @extends DialogComponent
 */
export class SizeGuideDialogComponent extends DialogComponent {
  requiredRefs = ['dialog', 'closeButton'];

  connectedCallback() {
    super.connectedCallback();
    
    // Set up click handler for size guide buttons using event delegation
    // This ensures it works even if buttons are dynamically added
    if (!document.hasSizeGuideListener) {
      document.addEventListener('click', this.#handleSizeGuideButtonClick, true);
      document.hasSizeGuideListener = true;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Note: We don't remove the listener on disconnect since it's shared
    // This is acceptable for event delegation patterns
  }

  /**
   * Handles clicks on size guide buttons
   * @param {Event} event - The click event
   * @private
   */
  #handleSizeGuideButtonClick = (event) => {
    const button = event.target.closest('[data-size-guide-button]');
    if (!button) return;

    // Find the size guide dialog instance
    const dialogElement = document.querySelector('size-guide-dialog');
    if (dialogElement && dialogElement.refs && dialogElement.refs.dialog) {
      event.preventDefault();
      event.stopPropagation();
      dialogElement.showDialog();
    }
  };
}

customElements.define('size-guide-dialog', SizeGuideDialogComponent);
