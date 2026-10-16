import React from 'react';
import type { Category } from '../lib/types';
import { recipeKind } from '../lib/cafe/recipe-kind';

export function RecipeArt({ category, variant = 0 }: { category: Category; variant?: number }) {
  const seed = Math.abs(variant);
  const color = ['#bc8c6a', '#b27c52', '#9aa77c', '#d3b4a0', '#9d7eac', '#b48459', '#d9b47b', '#b2a17b'][seed % 8];
  const shape = Math.floor(seed / 8) % 4;
  const dessert = recipeKind(category) === 'dessert';
  const hot = category === 'coffee';
  return <svg viewBox="0 0 240 180" aria-hidden="true" className="drink-art" data-recipe-kind={dessert ? 'dessert' : 'drink'}>
    <ellipse cx="120" cy="153" rx="67" ry="10" fill="#000" opacity=".12"/>
    {dessert ? <g data-art-family="dessert">
      <ellipse cx="120" cy="145" rx="64" ry="8" fill="#e8d8bb"/>
      {shape === 0 ? <>
        <path d="M70 96l85-37 21 70-89 14z" fill={color}/><path d="M70 96l85-37 10 15-85 39z" fill="#f0dec0"/><path d="M81 120l90-29" stroke="#684536" strokeWidth="7"/><path d="M87 138l89-26" stroke="#684536" strokeWidth="6"/><circle cx="146" cy="65" r="8" fill="#9d5c59"/>
      </> : shape === 1 ? <>
        <path d="M74 104h92l-13 35H88z" fill={color}/><circle cx="100" cy="92" r="25" fill="#e8d8bb"/><circle cx="140" cy="92" r="25" fill={color}/><circle cx="120" cy="66" r="24" fill="#e9d5b6"/><path d="M100 67q20 22 40 0" fill="none" stroke="#684536" strokeWidth="7"/><circle cx="120" cy="39" r="7" fill="#9d5c59"/>
      </> : shape === 2 ? <>
        <path d="M86 101h68l-10 40H96z" fill={color}/><path d="M82 101q0-20 18-26-7-18 12-23 8-4 9-19 24 15 21 33 18 1 17 17 15 5 4 18z" fill="#efddbd"/><path d="M101 110l5 23m17-23v23m16-23-5 23" stroke="#fff4da" strokeWidth="3"/><circle cx="121" cy="51" r="5" fill="#9d5c59"/>
      </> : <>
        <path d="M75 128l14-61h62l16 61q-45 24-92 0" fill={color}/><ellipse cx="120" cy="69" rx="31" ry="8" fill="#684536"/><path d="M97 89v28" stroke="#f7e7c7" strokeWidth="5" opacity=".6"/><path d="M111 51q13-18 26-7" stroke="#718558" strokeWidth="5" fill="none"/>
      </>}
    </g> : <g data-art-family={hot ? 'coffee' : category}>
      {hot && <g className="steam" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".5"><path d="M103 53q-10-9 0-19t0-15M124 49q-10-9 0-19t0-15M145 53q-10-9 0-19t0-15"/></g>}
      {hot ? <>
        <path d={shape === 0 ? 'M77 87q0 57 44 57t44-57z' : shape === 1 ? 'M83 72h74v58q-37 28-74 0z' : shape === 2 ? 'M74 93h92l-17 39q-30 20-58 0z' : 'M88 70h68l-8 70H96z'} fill={color}/>
        <path d="M160 94q37-2 19 28-8 11-25 5" stroke={color} strokeWidth="9" fill="none"/>
        <ellipse cx="121" cy={shape === 0 ? 87 : shape === 2 ? 93 : 72} rx={shape === 1 || shape === 3 ? 34 : 44} ry="10" fill="#e8d8bb"/><ellipse cx="121" cy={shape === 0 ? 88 : shape === 2 ? 94 : 73} rx="27" ry="6" fill="#61463a"/>
        <path d="M105 101v23" stroke="#f5dfbd" strokeWidth="4" opacity=".4"/>
      </> : <>
        <path d={shape === 0 ? 'M85 58h72l-10 84H95z' : shape === 1 ? 'M85 65q35-22 72 0v73q-35 16-72 0z' : shape === 2 ? 'M77 62h88q0 66-44 66T77 62z' : 'M97 44h48v16l13 19v60H84V79l13-19z'} fill={color}/>
        <path d={shape === 2 ? 'M82 77h78q-7 42-39 42T82 77z' : 'M91 84h60l-7 49h-47z'} fill={category === 'experimental' ? '#c5abc8' : '#765041'}/>
        <path d="M136 28l-13 80" stroke="#e8d9c0" strokeWidth="5"/>
        <rect x="102" y="93" width="15" height="15" rx="3" fill="#e8d9c0" opacity=".7"/><rect x="123" y="101" width="13" height="13" rx="3" fill="#e8d9c0" opacity=".6"/>
        {shape === 2 && <path d="M121 128v16m-20 3h40" stroke={color} strokeWidth="5"/>}
      </>}
    </g>}
    <g fill="#cfae78"><path d="M54 59l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/><path d="M186 44l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></g>
  </svg>;
}

export function CafeScene(){return <div className="scene" aria-label="Illustrated cozy café beneath a starry sky" role="img"><div className="scene-stars">✧ · . ✦ . · ✧ . · ✦</div><div className="scene-moon">☾</div><div className="cafe-window"><div/><div/><div/></div><div className="hanging-lamp"/><div className="cafe-sign">chill café<span>COFFEE & COSMIC COMPANY</span></div><div className="shelf"><span>▥</span><span>▤</span><span>✿</span></div><div className="counter"><div className="coffee-machine">▥<span>••</span></div><div className="scene-cup">☕</div><div className="plant">♧</div></div><div className="stool one"/><div className="stool two"/><div className="scene-caption"><span className="dot"/> OPEN FOR GOOD IDEAS <span>EST. ON TESTNET</span></div></div>}
