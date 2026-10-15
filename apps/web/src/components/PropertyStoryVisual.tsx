import { FileSearch, MapPinned, ShieldCheck } from 'lucide-react';

/** Animated editorial scene; every label states that it is illustrative, not a live title check. */
export function PropertyStoryVisual() {
  return (
    <div className="ojix-story-visual" role="img" aria-label="Illustrative animation of a villa, survey parcels, a property document and a review shield">
      <img className="story-property-art" src="/images/ojix-property-hero.webp" width="1536" height="1024" decoding="async" alt="Modern home with survey map, property papers and a verification shield" />
      <svg className="story-boundaries" viewBox="0 0 760 500" fill="none" aria-hidden="true">
        <path className="story-boundary-line line-one" d="M55 316 194 278l81 26 112-34 89 18 144-71"/>
        <path className="story-boundary-line line-two" d="m180 129 44 115-33 94 51 77m169-214-28 84 82 64-19 74m107-214-29 80 66 61"/>
        <path className="story-boundary-highlight" d="m296 289 72-29 65 32-12 80-86 23-56-43 17-63Z"/>
      </svg>
      <span className="story-map-tag"><MapPinned size={13}/> SURVEY PARCELS <i/> ILLUSTRATIVE</span>
      <span className="story-pin"><MapPinned size={17}/></span>
      <div className="story-document-tag"><span><FileSearch size={15}/></span><div><strong>Document review</strong><small>Illustrative interface detail</small></div><b aria-hidden="true"><i/><i/><i/></b></div>
      <span className="story-scan" aria-hidden="true"/>
      <span className="story-verified-tag"><ShieldCheck size={15}/> REVIEW WORKSPACE <small>Human review</small></span>
      <span className="story-scene-caption">Illustrative property review · No live verification shown</span>
    </div>
  );
}
