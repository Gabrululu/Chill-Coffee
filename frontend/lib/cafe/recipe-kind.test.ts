import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecipeArt } from '../../components/art';
import { categories } from '../types';
import { recipeArtVariant, recipeKind } from './recipe-kind';

test('30 variants of every category keep desserts and drinks visually distinct', () => {
  for (const category of categories) for (let variant = 0; variant < 30; variant++) {
    const svg = renderToStaticMarkup(createElement(RecipeArt, { category, variant }));
    assert.ok(svg.includes(`data-recipe-kind="${recipeKind(category)}"`));
    assert.ok(svg.includes(`data-art-family="${category === 'dessert' ? 'dessert' : category}"`));
    if (category !== 'coffee') assert.doesNotMatch(svg, /class="steam"/);
  }
});
test('recipe previews use a stable illustration seed from their name', () => {
  assert.equal(recipeArtVariant('Cosmic cake'), recipeArtVariant('Cosmic cake'));
  assert.notEqual(recipeArtVariant('Cosmic cake'), recipeArtVariant('Nebula latte'));
});
