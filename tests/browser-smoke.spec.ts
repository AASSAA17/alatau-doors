import {test,expect} from '@playwright/test';
test('Firefox: finder → selection → preview and localized information pages',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/ru/door-finder?step=4&type=interior&quantity=2&budget=90000');
  const card=page.getByTestId('finder-result');await card.getByRole('combobox').selectOption('d01-900');
  await card.getByRole('button',{name:'Добавить в подборку',exact:true}).click();
  await card.getByRole('link',{name:'Моя подборка'}).click();
  await expect(page.getByTestId('whatsapp-message')).toHaveValue(/178\s000/);
  await page.reload();await expect(page.getByTestId('request-line').getByRole('combobox')).toHaveValue('d01-900');
  await page.getByRole('link',{name:'ҚАЗ',exact:true}).click();await expect(page).toHaveURL('/kk/selection');
  await expect(page.getByTestId('whatsapp-message')).toHaveValue(/ДЕМОНСТРАЦИЯЛЫҚ/);
  for(const route of ['about','projects']){await page.goto(`/kk/${route}`);await expect(page.locator('main h1')).toBeVisible();}
  expect(errors).toEqual([]);
});
