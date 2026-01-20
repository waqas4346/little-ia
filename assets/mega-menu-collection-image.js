import { Component } from '@theme/component';

/**
 * Handles collection image swapping on hover in mega menu when menu_style is 'collection_image'
 */
class MegaMenuCollectionImage extends Component {
  connectedCallback() {
    super.connectedCallback();
    this.#init();
  }

  #init() {
    const container = this.querySelector('[data-collection-image-container="true"]');
    if (!container) return;

    const collectionLinks = this.querySelectorAll('[data-collection-image-link="true"]');
    if (collectionLinks.length === 0) return;

    // Find the image element(s) - could be a single image or multiple collection images
    const resourceCard = container.querySelector('.resource-card');
    if (!resourceCard) return;

    // Try to find a single featured image first
    let imageElement = resourceCard.querySelector('.resource-card__image:not(.resource-card__image--secondary)');
    
    // If no single image, try to find the first collection image (product images)
    if (!imageElement) {
      imageElement = resourceCard.querySelector('.resource-card__collection-image');
    }

    // If still no image, try the image wrapper
    if (!imageElement) {
      const imageWrapper = resourceCard.querySelector('.resource-card__image-wrapper');
      if (imageWrapper) {
        imageElement = imageWrapper.querySelector('img');
      }
    }

    if (!imageElement) return;

    // Get initial image URL from container if available
    const initialImageUrl = container.dataset.initialCollectionImageUrl;
    
    // Store the initial image source
    const initialSrc = imageElement.src;
    const initialSrcset = imageElement.srcset;

    collectionLinks.forEach((link) => {
      const imageUrl = link.dataset.collectionImageUrl;
      
      // Only swap if there's an image URL
      if (!imageUrl) return;

      link.addEventListener('mouseenter', () => {
        this.#updateImage(imageElement, imageUrl);
      });
    });

    // Reset to initial image when leaving the entire menu area
    const menuList = this.querySelector('[data-menu-list-id]');
    if (menuList) {
      menuList.addEventListener('mouseleave', () => {
        // Reset to initial image
        if (initialImageUrl) {
          this.#updateImage(imageElement, initialImageUrl);
        } else {
          // Fallback to stored src/srcset
          imageElement.src = initialSrc;
          if (initialSrcset) {
            imageElement.srcset = initialSrcset;
          }
        }
      });
    }
  }

  #updateImage(imageElement, imageUrl, srcset = null) {
    if (!imageElement || !imageUrl) return;

    // Update the image source
    imageElement.src = imageUrl;
    
    // If srcset is provided, update it; otherwise, generate a responsive srcset
    if (srcset) {
      imageElement.srcset = srcset;
    } else {
      // Generate responsive srcset for the new image
      try {
        const widths = [240, 352, 832, 1200, 1600];
        const srcsetValues = widths.map(width => {
          // Replace the width in the URL if it exists, or append it
          const url = new URL(imageUrl);
          url.searchParams.set('width', width);
          return `${url.toString()} ${width}w`;
        });
        imageElement.srcset = srcsetValues.join(', ');
      } catch (e) {
        // If URL parsing fails, just use the imageUrl as-is
        imageElement.srcset = '';
      }
    }

    // Update sizes attribute to maintain responsiveness if not already set
    if (!imageElement.sizes || imageElement.sizes === 'auto') {
      imageElement.sizes = '(min-width: 990px) 300px, 100vw';
    }
  }
}

if (!customElements.get('mega-menu-collection-image')) {
  customElements.define('mega-menu-collection-image', MegaMenuCollectionImage);
}
