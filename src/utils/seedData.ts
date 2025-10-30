import { supabase } from '../lib/supabase';

export async function seedSampleData() {
  try {
    const productsToInsert = [
      {
        sku: '301-9"x12"x12"',
        description: 'Wall Hung Cabinet | 1 Door',
        box_sf: 4.9,
        box_edgeband: 0.75,
        box_edgeband_color: 1.78,
        doors_fronts_sf: 1.5,
        doors_fronts_edgeband: 5.5,
        total_edgeband: 7.28,
        has_drawers: false,
      },
      {
        sku: '223-24"x30"x24"',
        description: 'Base Cabinet | 2 Drawers',
        box_sf: 42.3,
        box_edgeband: 3.1,
        box_edgeband_color: 0,
        doors_fronts_sf: 5.0,
        doors_fronts_edgeband: 6.15,
        total_edgeband: 15.75,
        has_drawers: true,
      },
    ];

    const priceListToInsert = [
      {
        sku_code: 'MEL-EVITA-15',
        concept_description: 'Melamine Evita Plus TBD 15mm x 4ft x 8ft',
        type: 'Melamine',
        material: 'MDF',
        dimensions: '4ft x 8ft',
        unit: 'Sheet',
        price: 52.0,
        sf_per_sheet: 32,
      },
      {
        sku_code: 'MDF-15',
        concept_description: 'MDF 15mm x 4ft x 8ft',
        type: 'MDF',
        material: 'MDF',
        dimensions: '4ft x 8ft',
        unit: 'Sheet',
        price: 45.0,
        sf_per_sheet: 32,
      },
      {
        sku_code: 'PLY-OAK-18',
        concept_description: 'Plywood Oak 18mm x 4ft x 8ft',
        type: 'Plywood',
        material: 'Oak',
        dimensions: '4ft x 8ft',
        unit: 'Sheet',
        price: 95.0,
        sf_per_sheet: 32,
      },
      {
        sku_code: 'EB-EVITA-19',
        concept_description: 'Edgeband Evita Plus Matching Finish 19x1mm',
        type: 'Edgeband',
        material: 'PVC',
        dimensions: '19x1mm',
        unit: 'Meter',
        price: 8.3,
        sf_per_sheet: null,
      },
      {
        sku_code: 'EB-WOOD-22',
        concept_description: 'Edgeband Natural Wood 22x1mm',
        type: 'Edgeband',
        material: 'Wood',
        dimensions: '22x1mm',
        unit: 'Meter',
        price: 8.3,
        sf_per_sheet: null,
      },
      {
        sku_code: 'HW-HINGE-SC',
        concept_description: 'Soft Close Hinges',
        type: 'Hinges',
        material: 'Metal',
        dimensions: null,
        unit: 'Piece',
        price: 4.5,
        sf_per_sheet: null,
      },
      {
        sku_code: 'HW-SLIDE-UM',
        concept_description: 'Undermount Drawer Slides',
        type: 'Slides',
        material: 'Metal',
        dimensions: null,
        unit: 'Piece',
        price: 12.0,
        sf_per_sheet: null,
      },
    ];

    const { error: productsError } = await supabase
      .from('products_catalog')
      .insert(productsToInsert);

    if (productsError) {
      console.error('Error inserting products:', productsError);
      return false;
    }

    const { error: pricesError } = await supabase
      .from('price_list')
      .insert(priceListToInsert);

    if (pricesError) {
      console.error('Error inserting prices:', pricesError);
      return false;
    }

    console.log('Sample data seeded successfully!');
    return true;
  } catch (error) {
    console.error('Error seeding data:', error);
    return false;
  }
}
