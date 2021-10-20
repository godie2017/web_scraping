const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({ headless: false }); //{ headless: false }
  const page = await browser.newPage();

  await page.goto('https://www.smv.gob.pe/Frm_InformacionFinanciera?data=A70181B60967D74090DCD93C4920AA1D769614EC12');
  await page.setViewport({width: 1200, height: 800});
  
  await page.type('#MainContent_TextBox1', 'TODOS')//COSAPI S.A.

  const selector = 'input[name="ctl00$MainContent$cbBuscar"]';
  await page.waitForSelector(selector)
  await page.evaluate((selector) => document.querySelector(selector).click(), selector);

  await page.waitForSelector('#MainContent_grdInfoFinanciera')

  var bd = []

  //Se extraen los textos y los links de la paginacion
  const paginacion = async () =>{
    
    const paginas = await page.evaluate(() =>{
      const tabla = document.querySelectorAll('.grid_paginado td table tbody tr td');

      const numeracion = [];
      for (let element=0; element<tabla.length; element++){
        var node = tabla[element].querySelector("a")
        if(node){
          numeracion.push({pagina:node.innerHTML, link:node.href})// para obtener los enlaces node.href
        };  
      }
      return numeracion;
    });
    return paginas
  }

  //Obtiene el ultimo numero de la paginacion
  const ultimaPagina = (paginacion) =>{
    return paginacion[paginacion.length-2].pagina !== '...' ? paginacion[paginacion.length-2].pagina : null
  }
  

  //Recorrelas paginas////// Sin uso
  const recorrePag = async () =>{
    let paginas = await paginacion();
    

    for(let element of paginas){
      console.log('Pagina: '+element.pagina)
      if(element.pagina <= 10 && element.pagina !== '...'){ //!== '...'
        //console.log('Pagina: '+element.pagina)
        //Se extrae los datos de la tabla segun la pagina
        bd.push({pagina: element.pagina, datos: await nuevoArray()})
        page.goto(element.link);//{waitUntil :'load'}
        
        await page.waitForTimeout(3000);
      }
    }
    await createJson(bd)
  }




 
  //Se crea un array con los datos de la tabla, sin elementos en blanco
  const nuevoArray = async (val) =>{
    //Se extrae todos los datos de la tabla
    var dict = await page.$$eval('.item-grid td', alldata => alldata.map((val) => val.textContent.trim()))

    //Nuevo array
    var info = [];
    var vectemp = [];
    for(i=0; i<dict.length; i++){
      if(dict[i] != ''){
        vectemp.push(dict[i]);
        if(vectemp.length == 5){
          info.push(vectemp);
          vectemp = [];
        }
        
      }
    }

    //Se eliminan datos basura
    if(val==1){
      info.splice(-12);
    }
    
    return info
  }
  

  //Se crear archivo .Json
  const createJson = async val =>{
    
    var data = JSON.stringify(val);
    //No eliminar el await
    await fs.writeFile("data.json", data, (err, result) => {
      if(err) console.log('error', err);
    });
  }

  

  const run = async () =>{

    let paginas = await paginacion();

    if(paginas.length > 1){
      let first = paginas[0].pagina
      let last = (ultimaPagina(paginas))-1;
      let i = 0;
      let num = 0

      while(i <= last){
        if(first !=='...'){
          bd.push({pagina: i+1, datos: await nuevoArray(val=1)})
          page.goto(paginas[num].link, {waitUntil: 'networkidle2',timeout: 0});
          await page.waitForTimeout(3000);
          
          if(i==last){
            paginas = await paginacion();
            first = paginas[0].pagina
            last = (ultimaPagina(paginas))-1;
            num=0
          }
          num++
          i++

        }else{
          await createJson(bd);
          console.log("Archivo temporal creado hasta la pagina: "+i);
          num=1
          bd.push({pagina: i+1, datos: await nuevoArray(val=1)})
          page.goto(paginas[num].link, {waitUntil: 'networkidle2',timeout: 0});
          await page.waitForTimeout(3000);
          first = paginas[1].pagina
          num++
          i++
        }
        
      }
      await createJson(bd);
      console.log("Archivo Json creado");

    }else{
      bd.push({pagina: 1, datos: await nuevoArray(val=0)})
      console.log('No hay paginacion')
      await createJson(bd);
    }
    
  }
  

  //Ejecucion del escript
  await run()
  



  await browser.close();
})();
