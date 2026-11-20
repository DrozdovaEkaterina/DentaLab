export const CASES=[
 {id:1,title:'Кариес жевательной поверхности',short:'Сохранить зуб',description:'Объёмное препарирование и восстановление дефекта.',available:true},
 {id:2,title:'Замена реставрации',short:'Заменить пломбу',description:'Осмотр старой реставрации и окружающих тканей. Рабочий зуб выделен цветом на полной модели челюсти.',available:false},
 {id:3,title:'Горизонтальный третий моляр',short:'Третий моляр',description:'Осмотр полости рта без цветового выделения отдельного зуба. Ориентируйтесь по анатомии.',available:false},
 {id:4,title:'Восстановление скола',short:'Восстановить зуб',description:'Осмотр зубного ряда без цветового выделения. Ориентируйтесь по форме и положению зубов.',available:false}
];
export function caseViewPolicy(id){return {view:id===1?'tooth':'mouth',highlight:id===2,canTreat:id===1};}
