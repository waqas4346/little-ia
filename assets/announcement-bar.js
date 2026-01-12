import { Component } from '@theme/component';
import { prefersReducedMotion } from '@theme/utilities';
import { Scroller } from '@theme/scrolling';

/**
 * Announcement banner custom element that allows fading between content.
 * Based on the Slideshow component.
 *
 * @typedef {object} Refs
 * @property {HTMLElement} slideshowContainer
 * @property {HTMLElement[]} [slides]
 * @property {HTMLButtonElement} [previous]
 * @property {HTMLButtonElement} [next]
 *
 * @extends {Component<Refs>}
 */
export class AnnouncementBar extends Component {
  #current = 0;
  #previousIndex = 0;
  #slidesContainer = null;
  #scroll = null;
  #disabled = false;

  /**
   * The interval ID for automatic playback.
   * @type {number|undefined}
   */
  #interval = undefined;

  connectedCallback() {
    super.connectedCallback();

    this.addEventListener('mouseenter', this.suspend);
    this.addEventListener('mouseleave', this.resume);
    document.addEventListener('visibilitychange', this.#handleVisibilityChange);

    // Setup scroller for smooth scrolling
    this.#slidesContainer = this.querySelector('.announcement-bar__slides');
    if (this.#slidesContainer) {
      // Prevent scroll events from affecting page scroll
      this.#slidesContainer.addEventListener('scroll', (e) => {
        e.stopPropagation();
      }, { passive: true });

      // Setup Scroller instance (like slideshow component)
      this.#scroll = new Scroller(this.#slidesContainer, {
        onScroll: () => {},
        onScrollStart: () => {},
        onScrollEnd: () => {},
      });
    }

    // Set initial position - wait for refs to be ready
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const slides = this.refs.slides ?? [];
        if (slides.length > 0 && this.#scroll) {
          this.#previousIndex = 0;
          this.#scroll.to(slides[0], { instant: true });
        }
        this.play();
      });
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.#scroll) {
      this.#scroll.destroy();
    }
  }


  next() {
    if (this.#disabled || !this.#scroll) return;
    // Use void to handle async setter
    void (this.current = this.#current + 1);
  }

  previous() {
    if (this.#disabled || !this.#scroll) return;
    // Use void to handle async setter
    void (this.current = this.#current - 1);
  }

  /**
   * Starts automatic slide playback.
   * @param {number} [interval] - The time interval in seconds between slides.
   */
  play(interval = this.autoplayInterval) {
    if (!this.autoplay) return;

    this.paused = false;

    this.#interval = setInterval(() => {
      if (this.matches(':hover') || document.hidden) return;

      this.next();
    }, interval);
  }

  /**
   * Pauses automatic slide playback.
   */
  pause() {
    this.paused = true;
    this.suspend();
  }

  get paused() {
    return this.hasAttribute('paused');
  }

  set paused(paused) {
    this.toggleAttribute('paused', paused);
  }

  /**
   * Suspends automatic slide playback.
   */
  suspend() {
    clearInterval(this.#interval);
    this.#interval = undefined;
  }

  /**
   * Resumes automatic slide playback if autoplay is enabled.
   */
  resume() {
    if (!this.autoplay || this.paused) return;

    this.pause();
    this.play();
  }

  get autoplay() {
    return Boolean(this.autoplayInterval);
  }

  get autoplayInterval() {
    const interval = this.getAttribute('autoplay');
    const value = parseInt(`${interval}`, 10);

    if (Number.isNaN(value)) return undefined;

    return value * 1000;
  }

  get current() {
    return this.#current;
  }

  set current(current) {
    const slides = this.refs.slides ?? [];
    if (!slides.length || !this.#scroll) {
      this.#current = current;
      return;
    }

    const previousIndex = this.#previousIndex;
    this.#current = current;

    let relativeIndex = current % slides.length;
    if (relativeIndex < 0) {
      relativeIndex += slides.length;
    }

    const targetSlide = slides[relativeIndex];
    if (!targetSlide) return;

    const currentSlide = slides[previousIndex];
    const lastIndex = slides.length - 1;
    
    // Check if this is an adjacent slide (like slideshow component)
    // Adjacent means: difference is <= 1 AND we're not wrapping
    // Wrapping (last->first or first->last) is NOT adjacent, so we use placeholder trick
    const isAdjacentSlide = Math.abs(relativeIndex - previousIndex) <= 1 && 
                            !((previousIndex === lastIndex && relativeIndex === 0) ||
                              (previousIndex === 0 && relativeIndex === lastIndex));
    const instant = prefersReducedMotion();

    // Use placeholder + reorder trick for seamless infinite scroll when wrapping
    // This creates the illusion of seamless wrapping without showing all slides
    if (!instant && !isAdjacentSlide && slides.length > 1) {
      // Use async IIFE to handle the async operations
      (async () => {
        this.#disabled = true;
        await this.#scroll.finished; // ensure we're not mid-scroll

        if (!targetSlide || !currentSlide) {
          this.#disabled = false;
          return;
        }

        // Create a placeholder in the original DOM position of targetSlide
        const placeholder = document.createElement('slideshow-slide');
        placeholder.className = targetSlide.className;
        placeholder.style.cssText = targetSlide.style.cssText;
        targetSlide.before(placeholder);

        // Decide whether targetSlide goes before or after currentSlide
        // so that we scroll a short distance in the correct direction
        // For wrapping: last->first should place first after last, first->last should place last before first
        if (previousIndex === lastIndex && relativeIndex === 0) {
          // Wrapping forward: last to first - place first slide after last
          currentSlide.after(targetSlide);
        } else if (previousIndex === 0 && relativeIndex === lastIndex) {
          // Wrapping backward: first to last - place last slide before first
          currentSlide.before(targetSlide);
        } else if (relativeIndex < previousIndex) {
          // Going backward (non-wrapping)
          currentSlide.before(targetSlide);
        } else {
          // Going forward (non-wrapping)
          currentSlide.after(targetSlide);
        }

        // Scroll to the reordered target slide smoothly
        this.#scroll.to(targetSlide, { instant: false });

        // Once that scroll finishes, restore the DOM
        this.#scroll.finished.then(() => {
          // Restore the slide back to its original position
          placeholder.replaceWith(targetSlide);

          // Instantly scroll to the target slide as its position will have changed
          // This happens so fast it appears seamless
          this.#scroll.to(targetSlide, { instant: true });
          
          // Wait a bit then re-enable
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.#disabled = false;
            });
          });
        });
      })();
    } else {
      // Normal adjacent scroll or instant - use Scroller which handles page scroll preservation
      targetSlide.setAttribute('aria-hidden', 'false');
      this.#scroll.to(targetSlide, { instant });
    }

    // Update aria-hidden for accessibility
    slides.forEach((slide, index) => {
      slide.setAttribute('aria-hidden', `${index !== relativeIndex}`);
    });

    this.#previousIndex = relativeIndex;
  }

  /**
   * Pause the slideshow when the page is hidden.
   */
  #handleVisibilityChange = () => (document.hidden ? this.pause() : this.resume());
}

if (!customElements.get('announcement-bar-component')) {
  customElements.define('announcement-bar-component', AnnouncementBar);
}
