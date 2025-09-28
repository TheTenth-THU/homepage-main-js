import template from "./template/template.html"

/**
 * A HTML template for TheTenthTHU homepage.
 */
class HtmlTemplate {
    constructor(title = '', main = '') {
        // Prepare the HTML template
        const parser = new DOMParser();
        this.document = parser.parseFromString(template, 'text/html');
        this.titleElement = this.document.querySelector('head > title');
        this.mainElement = this.document.querySelector('body > main');
        if (title) {
            this.titleElement.textContent = title;
        }
        if (main) {
            this.mainElement.innerHTML = main;
        }
    }

    /**
     * Get the HTML string.
     * @returns {string} The HTML string.
     */
    toString() {
        return `<!DOCTYPE html>\n${this.document.documentElement.outerHTML}`;
    }

    /**
     * Append content to the main element.
     * @param {string} content The content to append.
     */
    appendToMain(content) {
        this.mainElement.insertAdjacentHTML('beforeend', content);
    }

    /**
     * Add a CSS file to the head.
     * @param {string} href The CSS file URL.
     */
    addCssFileToHead(href) {
        const linkElement = this.document.createElement('link');
        linkElement.rel = 'stylesheet';
        linkElement.href = href;
        this.document.head.appendChild(linkElement);
    }

    /**
     * Append script to the end of body.
     * @param {string} script The script content to append.
     */
    appendScriptToBody(script) {
        const scriptElement = this.document.createElement('script');
        scriptElement.textContent = script;
        this.document.body.appendChild(scriptElement);
    }

    /**
     * Add a script file to the end of body.
     * @param {string} src The script file URL.
     */
    addScriptFileToBody(src) {
        const scriptElement = this.document.createElement('script');
        scriptElement.src = src;
        this.document.body.appendChild(scriptElement);
    }
}

export default HtmlTemplate;