import { Injectable } from '@angular/core';
import { Diet } from '../models/diet.model';

@Injectable({ providedIn: 'root' })
export class DietDataService {

  readonly diet: Diet = {
    on: {
      colazione: {
        variants: [
          {
            label: 'Base', items: [
              { name: 'Uova di gallina - albume', qty: '200 g' },
              { name: 'Farina d\'avena', qty: '5 cucchiai · 50 g' },
              { name: 'Burro d\'arachidi', qty: '2 cucchiaini · 10 g' }
            ]
          },
          {
            label: 'Alt. 1', items: [
              { name: 'Yogurt greco 0% bianco', qty: '200 g' },
              { name: 'Fiocchi d\'avena', qty: '4 cucchiai · 40 g', alt: [{ name: 'Riso soffiato', qty: '4 cucchiai · 40 g' }, { name: 'Fette biscottate integrali', qty: '4 fette · 40 g' }] },
              { name: 'Frutta secca e oleosa (media)', qty: '10 g', alt: [{ name: 'Semi di chia', qty: '10 g' }] }
            ]
          },
          {
            label: 'Alt. 2', items: [
              { name: 'Uova di gallina (media)', qty: '120 g' },
              { name: 'Pane tostato', qty: '2 fette · 50 g' },
              { name: 'Uova di gallina - albume', qty: '70 g' }
            ]
          },
          {
            label: 'Alt. 3', items: [
              { name: 'Proteine isolate - Myprotein', qty: '20 g' },
              { name: 'Cornflakes (senza zuccheri aggiunti)', qty: '4 cucchiai · 40 g', alt: [{ name: 'Crusca di frumento', qty: '5 cucchiai · 50 g' }] },
              { name: 'Frutta secca e oleosa (media)', qty: '20 g' }
            ]
          }
        ]
      },
      spuntino: {
        items: [
          { name: 'Proteine isolate - Myprotein', qty: '25 g', alt: [{ name: 'Fesa di tacchino arrosto', qty: '80 g' }, { name: 'Bresaola', qty: '70 g' }, { name: 'Yogurt greco 0% bianco', qty: '200 g' }, { name: 'Uova di gallina - albume', qty: '200 g' }] },
          { name: 'Pane di segale', qty: '2 fette · 60 g', alt: [{ name: 'Gallette di riso', qty: '4 fette · 40 g' }, { name: 'Pane azzimo', qty: '1 panino · 40 g' }, { name: 'Frutta fresca (media)', qty: '200 g' }, { name: 'Farina d\'avena', qty: '4 cucchiai · 40 g' }] },
          { name: 'Frutta secca e oleosa (media)', qty: '15 g' }
        ]
      },
      pranzo: {
        items: [
          { name: 'Riso', qty: '3 cucchiai · 60 g', alt: [{ name: 'Pasta di semola integrale', qty: '1 piatto · 70 g' }, { name: 'Patate (media)', qty: '280 g' }, { name: 'Gnocchi', qty: '130 g' }, { name: 'Cous cous', qty: '60 g' }] },
          { name: 'Petto di pollo', qty: '200 g', alt: [{ name: 'Tacchino petto', qty: '200 g' }, { name: 'Merluzzo o nasello', qty: '250 g' }, { name: 'Tonno al naturale - Nostromo', qty: '200 g' }, { name: 'Calamaro', qty: '300 g' }, { name: 'Seppia', qty: '250 g' }, { name: 'Gamberetti sgusciati', qty: '250 g' }, { name: 'Rombo', qty: '250 g' }, { name: 'Filetti di platessa - Orogel', qty: '250 g' }] },
          { name: 'Verdure fresche (media)', qty: '150 g' },
          { name: 'Olio di oliva (media)', qty: '10 g' }
        ]
      },
      merenda: {
        items: [
          { name: 'Proteine isolate - Myprotein', qty: '40 g', alt: [{ name: 'Yogurt greco 0% bianco', qty: '300 g' }, { name: 'Uova di gallina - albume', qty: '300 g' }] },
          { name: 'Frutta secca e oleosa (media)', qty: '15 g', alt: [{ name: 'Parmigiano', qty: '20 g' }] }
        ]
      },
      cena: {
        items: [
          { name: 'Riso', qty: '1 piatto e 1/4 · 100 g', alt: [{ name: 'Pasta di semola integrale', qty: '1 piatto e 1/4 · 100 g' }, { name: 'Patate (media)', qty: '300 g' }, { name: 'Gnocchi', qty: '200 g' }, { name: 'Cous cous', qty: '90 g' }] },
          { name: 'Petto di pollo', qty: '200 g', alt: [{ name: 'Tacchino petto', qty: '200 g' }, { name: 'Merluzzo o nasello', qty: '250 g' }, { name: 'Tonno al naturale - Nostromo', qty: '200 g' }, { name: 'Calamaro', qty: '250 g' }, { name: 'Seppia', qty: '250 g' }, { name: 'Gamberetti sgusciati', qty: '250 g' }, { name: 'Rombo', qty: '250 g' }, { name: 'Filetti di platessa - Orogel', qty: '250 g' }] },
          { name: 'Verdure fresche (media)', qty: '150 g' },
          { name: 'Olio di oliva (media)', qty: '10 g' }
        ]
      }
    },
    off: {
      colazione: {
        variants: [
          {
            label: 'Base', items: [
              { name: 'Uova di gallina - albume', qty: '200 g' },
              { name: 'Farina d\'avena', qty: '5 cucchiai · 50 g' },
              { name: 'Burro d\'arachidi', qty: '2 cucchiaini · 10 g' }
            ]
          },
          {
            label: 'Alt. 1', items: [
              { name: 'Yogurt greco 0% bianco', qty: '200 g' },
              { name: 'Fiocchi d\'avena', qty: '4 cucchiai · 40 g', alt: [{ name: 'Riso soffiato', qty: '4 cucchiai · 40 g' }, { name: 'Fette biscottate integrali', qty: '4 fette · 40 g' }] },
              { name: 'Frutta secca e oleosa (media)', qty: '10 g', alt: [{ name: 'Semi di chia', qty: '10 g' }] }
            ]
          },
          {
            label: 'Alt. 2', items: [
              { name: 'Uova di gallina (media)', qty: '120 g' },
              { name: 'Pane tostato', qty: '2 fette · 50 g' },
              { name: 'Uova di gallina - albume', qty: '70 g' }
            ]
          },
          {
            label: 'Alt. 3', items: [
              { name: 'Proteine isolate - Myprotein', qty: '20 g' },
              { name: 'Cornflakes (senza zuccheri aggiunti)', qty: '4 cucchiai · 40 g', alt: [{ name: 'Crusca di frumento', qty: '5 cucchiai · 50 g' }] },
              { name: 'Frutta secca e oleosa (media)', qty: '20 g' }
            ]
          }
        ]
      },
      spuntino: {
        items: [
          { name: 'Proteine isolate - Myprotein', qty: '25 g', alt: [{ name: 'Yogurt greco 0% bianco', qty: '200 g' }, { name: 'Uova di gallina - albume', qty: '200 g' }] },
          { name: 'Frutta secca e oleosa (media)', qty: '20 g', alt: [{ name: 'Parmigiano', qty: '20 g' }] }
        ]
      },
      pranzo: {
        items: [
          { name: 'Riso', qty: '3 cucchiai · 60 g', alt: [{ name: 'Pasta di semola integrale', qty: '1 piatto · 70 g' }, { name: 'Patate (media)', qty: '280 g' }, { name: 'Gnocchi', qty: '130 g' }, { name: 'Cous cous', qty: '60 g' }] },
          { name: 'Petto di pollo', qty: '200 g', alt: [{ name: 'Tacchino petto', qty: '200 g' }, { name: 'Merluzzo o nasello', qty: '250 g' }, { name: 'Tonno al naturale - Nostromo', qty: '200 g' }, { name: 'Calamaro', qty: '250 g' }, { name: 'Seppia', qty: '250 g' }, { name: 'Gamberetti sgusciati', qty: '250 g' }, { name: 'Rombo', qty: '250 g' }, { name: 'Filetti di platessa - Orogel', qty: '250 g' }, { name: 'Salmone fresco', qty: '200 g — togli 10 g di olio dal pasto' }, { name: 'Pesce spada', qty: '200 g' }] },
          { name: 'Verdure fresche (media)', qty: '150 g' },
          { name: 'Olio di oliva (media)', qty: '20 g' }
        ]
      },
      merenda: {
        items: [
          { name: 'Proteine isolate - Myprotein', qty: '40 g', alt: [{ name: 'Yogurt greco 0% bianco', qty: '300 g' }, { name: 'Uova di gallina - albume', qty: '300 g' }] },
          { name: 'Frutta secca e oleosa (media)', qty: '20 g', alt: [{ name: 'Parmigiano', qty: '20 g' }] }
        ]
      },
      cena: {
        items: [
          { name: 'Riso', qty: '3 cucchiai · 60 g', alt: [{ name: 'Pasta di semola integrale', qty: '3/4 di piatto · 60 g' }, { name: 'Patate (media)', qty: '250 g' }, { name: 'Gnocchi', qty: '120 g' }, { name: 'Cous cous', qty: '60 g' }] },
          { name: 'Petto di pollo', qty: '200 g', alt: [{ name: 'Tacchino petto', qty: '200 g' }, { name: 'Merluzzo o nasello', qty: '250 g' }, { name: 'Tonno al naturale - Nostromo', qty: '200 g' }, { name: 'Calamaro', qty: '250 g' }, { name: 'Seppia', qty: '250 g' }, { name: 'Gamberetti sgusciati', qty: '250 g' }, { name: 'Rombo', qty: '250 g' }, { name: 'Filetti di platessa - Orogel', qty: '250 g' }, { name: 'Vitello - filetto', qty: '200 g' }, { name: 'Salmone fresco', qty: '200 g' }, { name: 'Pesce spada', qty: '200 g' }] },
          { name: 'Verdure fresche (media)', qty: '150 g' },
          { name: 'Olio di oliva (media)', qty: '20 g' }
        ]
      }
    }
  };
}
