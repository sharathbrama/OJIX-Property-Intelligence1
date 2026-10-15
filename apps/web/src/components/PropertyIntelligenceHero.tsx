/** Editorial hero artwork for the sign-in page; it represents a workflow, not live property data. */
export function PropertyIntelligenceHero() {
  return (
    <figure className="property-intelligence-hero">
      <div className="hero-visual-heading">
        <span>PROPERTY REVIEW WORKSPACE</span>
        <span className="hero-illustrative-label">ILLUSTRATIVE VIEW</span>
      </div>
      <img
        className="hero-property-image"
        src="/images/ojix-property-hero.webp"
        alt="A modern villa beside Karnataka survey parcels, reviewed property documents and a verification shield"
        width="1536"
        height="1024"
        fetchPriority="high"
        decoding="async"
      />
    </figure>
  );
}
