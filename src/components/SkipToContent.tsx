/**
 * Accessibility: Skip-to-main-content link.
 * Visually hidden until it receives keyboard focus, then becomes a prominent
 * pill in the top-left so keyboard / screen-reader users can bypass the header.
 *
 * Pair with an element on each page that has`id="main-content"` and (ideally)
 *`tabIndex={-1}` so focus moves there when activated.
 */
const SkipToContent = () => {
 return (
 <a
 href="#main-content"
 className="
 sr-only
 
 
 
 
 
 
 
 
"
 >
 Skip to main content
 </a>
 );
};

export default SkipToContent;
