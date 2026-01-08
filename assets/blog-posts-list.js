import PaginatedList from '@theme/paginated-list';
import { viewTransition, requestIdleCallback } from '@theme/utilities';
import { sectionRenderer } from '@theme/section-renderer';

/**
 * A custom element that renders a paginated blog posts list
 */
export default class BlogPostsList extends PaginatedList {
  /** @type {((value: void) => void) | null} */
  #buttonResolveNextPagePromise = null;

  connectedCallback() {
    // Check if infinite scroll is enabled before calling super
    const infiniteScroll = this.getAttribute('infinite-scroll');
    const isInfiniteScroll = infiniteScroll !== 'false';

    super.connectedCallback();

    // If infinite scroll is disabled, set up button click handler instead
    if (!isInfiniteScroll) {
      // Disconnect the intersection observer if it was set up
      if (this.infinityScrollObserver) {
        this.infinityScrollObserver.disconnect();
        this.infinityScrollObserver = undefined;
      }
      
      this.#setupLoadMoreButton();
    }
  }

  #setupLoadMoreButton() {
    const { loadMoreButton, grid } = this.refs;
    
    if (!loadMoreButton) return;

    loadMoreButton.addEventListener('click', async () => {
      // Wait for any in-progress view transitions to finish
      if (viewTransition.current) await viewTransition.current;

      // Disable button while loading
      loadMoreButton.disabled = true;
      const originalText = loadMoreButton.textContent;
      loadMoreButton.textContent = 'Loading...';

      try {
        // Render next page using the parent's method
        await this.#renderNextPageForButton();

        // Update button state based on whether there are more pages
        if (grid) {
          const lastPage = grid.dataset.lastPage;
          const currentPage = this.#getCurrentPage();
          
          if (currentPage >= Number(lastPage)) {
            // No more pages, hide button
            loadMoreButton.style.display = 'none';
          } else {
            // Re-enable button
            loadMoreButton.disabled = false;
            loadMoreButton.textContent = originalText;
          }
        }
      } catch (error) {
        console.error('Error loading more posts:', error);
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = originalText;
      }
    });
  }

  #getCurrentPage() {
    const { cards } = this.refs;
    if (!Array.isArray(cards) || cards.length === 0) return 1;
    
    const lastCard = cards[cards.length - 1];
    return Number(lastCard?.dataset.page || 1);
  }

  // Render next page - similar to parent's #renderNextPage but accessible
  async #renderNextPageForButton() {
    const { grid } = this.refs;
    if (!grid) return;

    const nextPage = this.#getPageForButton('next');
    if (!nextPage || !this.#shouldUsePageForButton(nextPage)) return;
    
    let nextPageItemElements = this.#getGridForPageForButton(nextPage.page);
    
    if (!nextPageItemElements) {
      const promise = new Promise((res) => {
        this.#buttonResolveNextPagePromise = res;
      });

      this.#fetchPageForButton('next');
      await promise;
      nextPageItemElements = this.#getGridForPageForButton(nextPage.page);
      if (!nextPageItemElements) return;
    }

    grid.append(...nextPageItemElements);

    // Note: We don't update the URL for Load More button to avoid page refresh showing only one page
    // The content loads progressively but the URL remains on the base blog page

    // Prefetch next page
    requestIdleCallback(() => {
      this.#fetchPageForButton('next');
    });
  }

  #getPageForButton(type) {
    const { cards } = this.refs;
    const isPrevious = type === 'previous';

    if (!Array.isArray(cards)) return;

    const targetCard = cards[isPrevious ? 0 : cards.length - 1];
    if (!targetCard) return;

    const currentCardPage = Number(targetCard.dataset.page);
    const page = isPrevious ? currentCardPage - 1 : currentCardPage + 1;

    const url = new URL(window.location.href);
    url.searchParams.set('page', page.toString());
    url.hash = '';

    return { page, url };
  }

  #shouldUsePageForButton(pageInfo) {
    if (!pageInfo) return false;

    const { grid } = this.refs;
    const lastPage = grid?.dataset.lastPage;

    if (!lastPage || pageInfo.page < 1 || pageInfo.page > Number(lastPage)) return false;

    return true;
  }

  #getGridForPageForButton(page) {
    const pageHTML = this.pages.get(page);
    if (!pageHTML) return;

    const parsedPage = new DOMParser().parseFromString(pageHTML, 'text/html');
    const gridElement = parsedPage.querySelector('[ref="grid"]');
    if (!gridElement) return;
    return gridElement.querySelectorAll(':scope > [ref="cards[]"]');
  }

  async #fetchPageForButton(type) {
    const page = this.#getPageForButton(type);
    const resolvePromise = () => {
      if (type === 'next') {
        this.#buttonResolveNextPagePromise?.();
        this.#buttonResolveNextPagePromise = null;
      }
    };

    if (!page || !this.#shouldUsePageForButton(page)) {
      resolvePromise();
      return;
    }

    await this.#fetchSpecificPageForButton(page.page, page.url);
    resolvePromise();
  }

  async #fetchSpecificPageForButton(pageNumber, url = undefined) {
    const pageInfo = { page: pageNumber, url };

    if (!url) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('page', pageNumber.toString());
      newUrl.hash = '';
      pageInfo.url = newUrl;
    }

    if (!this.#shouldUsePageForButton(pageInfo)) return;
    
    const pageContent = await sectionRenderer.getSectionHTML(this.sectionId, true, pageInfo.url);
    this.pages.set(pageNumber, pageContent);
  }
}

if (!customElements.get('blog-posts-list')) {
  customElements.define('blog-posts-list', BlogPostsList);
}
