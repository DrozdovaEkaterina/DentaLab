// Completion combines measured model safety with the learner's visual review.
// A percentage alone cannot certify the chosen boundary of tissue removal.
export function prepStatus(stats,{diagnosed=false,isolated=false,reviewed=false,complete=false}={}){
 const started=stats.removedVolume>0,prepared=diagnosed&&isolated,safe=!stats.critical;
 const ready=prepared&&started&&safe&&reviewed;
 return {started,prepared,safe,ready,done:ready&&complete,title:!safe?'Остановитесь: повреждение пульпы':ready&&complete?'Этап 3 завершён':ready?'Готово к восстановлению':!prepared?'Подготовьте рабочее поле':!started?'Начните обработку':!reviewed?'Проверьте границы полости':'Продолжайте проверку',progress:Math.round(([prepared,started,safe&&started,reviewed].filter(Boolean).length/4)*100)};
}
